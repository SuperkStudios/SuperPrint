import WebSocket from "ws";
import { Prisma } from "@prisma/client";
import {
  buildCentauriStatusRefreshRequest,
  buildPrinterHeartbeatUpdate,
  parseCentauriStatusTelemetry,
  type PublicPrinterTelemetry
} from "@/domain/printer-heartbeat";
import type { CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { probePrinterConnection } from "@/domain/bootstrap";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const telemetryCache = new Map<string, { telemetry: PublicPrinterTelemetry | null; checkedAtMs: number; inFlight?: Promise<PublicPrinterTelemetry | null> }>();
const TELEMETRY_CACHE_MS = 2500;
const MANUAL_PRINT_PROGRESS_EVENT_STEP = 5;

export async function refreshPrinterHeartbeat(printerId: string) {
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId } });
  const startedAt = Date.now();
  const result = await probePrinterConnection(
    { internalIp: printer.internalIp, controlApiUrl: printer.controlApiUrl },
    { timeoutMs: 1500 }
  );
  const update = buildPrinterHeartbeatUpdate({
    ok: result.ok,
    message: result.message,
    checkedAt: new Date(),
    latencyMs: Date.now() - startedAt
  });

  return prisma.printer.update({
    where: { id: printer.id },
    data: {
      ...update,
      cameraStatus: result.ok ? "ONLINE" : "OFFLINE"
    },
    include: { currentFilament: true }
  });
}

export async function refreshAllPrinterHeartbeats() {
  const printers = await prisma.printer.findMany({ orderBy: { publicName: "asc" } });
  return Promise.all(printers.map((printer) => refreshPrinterHeartbeat(printer.id)));
}

export async function readPrinterTelemetry(printerId: string): Promise<PublicPrinterTelemetry | null> {
  const cached = telemetryCache.get(printerId);
  const now = Date.now();
  if (cached?.inFlight) return cached.inFlight;
  if (cached && now - cached.checkedAtMs < TELEMETRY_CACHE_MS) return cached.telemetry;

  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId } });
  if (!printer.controlApiUrl.startsWith("ws")) return null;
  const inFlight = readCentauriTelemetry(printer.controlApiUrl, 3500).then((telemetry) => {
    telemetryCache.set(printerId, { telemetry, checkedAtMs: Date.now() });
    return telemetry;
  }).finally(() => {
    const next = telemetryCache.get(printerId);
    if (next?.inFlight === inFlight) {
      telemetryCache.set(printerId, { telemetry: next.telemetry, checkedAtMs: next.checkedAtMs });
    }
  });
  telemetryCache.set(printerId, { telemetry: cached?.telemetry ?? null, checkedAtMs: cached?.checkedAtMs ?? 0, inFlight });
  const telemetry = await inFlight;
  if (telemetry) {
    await recordManualPrintDetection(printer.id, telemetry).catch(() => undefined);
  }
  return telemetry;
}

export async function recordManualPrintDetection(printerId: string, telemetry: PublicPrinterTelemetry) {
  if (!isManualPrintTelemetry(telemetry) || !telemetry.currentFileName) return;
  const activeQueuedJob = await prisma.printJob.findFirst({
    where: { printerId, status: { in: ["PRINTING", "AWAITING_OPERATOR_START", "READY_ON_NODE"] } },
    select: { id: true }
  });
  if (activeQueuedJob) return;

  const key = `manualPrint.active.${printerId}`;
  const current = await prisma.systemSetting.findUnique({ where: { key } });
  const currentManualPrint = readManualPrintSnapshot(current?.value);
  const nextManualPrint = {
    fileName: telemetry.currentFileName,
    firstSeenAt: isSameManualPrint(current?.value, telemetry.currentFileName) ? currentManualPrint?.firstSeenAt ?? telemetry.updatedAt : telemetry.updatedAt,
    lastSeenAt: telemetry.updatedAt,
    progressPercent: telemetry.progressPercent,
    currentLayer: telemetry.currentLayer,
    totalLayer: telemetry.totalLayer,
    printStatus: telemetry.printStatus,
    printStatusLabel: telemetry.printStatusLabel,
    completed: telemetry.printStatus === 9 || telemetry.progressPercent === 100
  };

  if (isSameManualPrint(current?.value, telemetry.currentFileName)) {
    await prisma.systemSetting.update({
      where: { key },
      data: { value: nextManualPrint }
    });
    if (shouldUpdateManualPrintEvent(currentManualPrint, nextManualPrint)) {
      await updateLatestManualPrintEvent(nextManualPrint);
    }
    return;
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: nextManualPrint },
    create: { key, value: nextManualPrint }
  });

  await recordPlatformEvent({
    type: "MANUAL_PRINT_DETECTED",
    payload: manualPrintEventPayload(nextManualPrint)
  });
}

export function isSameManualPrint(value: unknown, fileName: string) {
  return Boolean(value && typeof value === "object" && "fileName" in value && value.fileName === fileName);
}

export async function syncManualPrintEventsFromHistory(prints: CompletedPrinterHistoryItem[]) {
  const historyByName = new Map<string, CompletedPrinterHistoryItem & { progressPercent: number; completed: boolean }>();
  for (const print of prints.filter((item) => ["COMPLETED", "FAILED", "STOPPED"].includes(item.status))) {
    const progressPercent = progressPercentForHistoryPrint(print);
    const completed = print.status === "COMPLETED";
    const key = normalizeFileName(print.name);
    const existing = historyByName.get(key);
    if (!existing || progressPercent > existing.progressPercent || (completed && !existing.completed)) {
      historyByName.set(key, { ...print, progressPercent, completed });
    }
  }
  if (!historyByName.size) return { updated: 0 };

  const manualEvents = await prisma.platformEvent.findMany({
    where: { type: "MANUAL_PRINT_DETECTED" },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  let updated = 0;
  for (const event of manualEvents) {
    const payload = readEventPayload(event.payload);
    const fileName = typeof payload.fileName === "string" ? payload.fileName : null;
    if (!fileName) continue;
    const history = historyByName.get(normalizeFileName(fileName));
    if (!history) continue;
    const progressPercent = typeof payload.progressPercent === "number" ? payload.progressPercent : 0;
    if (progressPercent >= history.progressPercent && payload.completed === history.completed) continue;

    await prisma.platformEvent.update({
      where: { id: event.id },
      data: {
        payload: {
          ...payload,
          progressPercent: history.progressPercent,
          currentLayer: history.completed ? history.totalLayers ?? history.printedLayers ?? payload.currentLayer ?? null : history.printedLayers ?? payload.currentLayer ?? null,
          totalLayer: history.totalLayers ?? payload.totalLayer ?? null,
          completed: history.completed,
          historyStatus: history.status
        } as Prisma.InputJsonObject
      }
    });
    updated += 1;
  }

  return { updated };
}

function isManualPrintTelemetry(telemetry: PublicPrinterTelemetry) {
  return telemetry.machineStatus === 1 || telemetry.printStatus === 9 || telemetry.progressPercent === 100;
}

type ManualPrintSnapshot = {
  fileName: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  progressPercent: number | null;
  currentLayer: number | null;
  totalLayer: number | null;
  printStatus?: number | null;
  printStatusLabel?: string;
  completed?: boolean;
};

function readManualPrintSnapshot(value: unknown): ManualPrintSnapshot | null {
  if (!value || typeof value !== "object" || !("fileName" in value) || typeof value.fileName !== "string") return null;
  return value as ManualPrintSnapshot;
}

function shouldUpdateManualPrintEvent(current: ManualPrintSnapshot | null, next: ManualPrintSnapshot) {
  if (!current) return true;
  if (next.completed && !current.completed) return true;
  const currentProgress = current.progressPercent ?? 0;
  const nextProgress = next.progressPercent ?? 0;
  if (nextProgress >= 100 && currentProgress < 100) return true;
  return nextProgress - currentProgress >= MANUAL_PRINT_PROGRESS_EVENT_STEP;
}

async function updateLatestManualPrintEvent(print: ManualPrintSnapshot) {
  const event = await prisma.platformEvent.findFirst({
    where: {
      type: "MANUAL_PRINT_DETECTED",
      payload: {
        path: ["fileName"],
        equals: print.fileName
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!event) {
    await recordPlatformEvent({ type: "MANUAL_PRINT_DETECTED", payload: manualPrintEventPayload(print) });
    return;
  }

  await prisma.platformEvent.update({
    where: { id: event.id },
    data: {
      payload: {
        ...((event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {}) as Record<string, unknown>),
        ...manualPrintEventPayload(print)
      } as Prisma.InputJsonObject
    }
  });
}

function manualPrintEventPayload(print: ManualPrintSnapshot) {
  return {
    fileName: print.fileName,
    progressPercent: print.progressPercent,
    currentLayer: print.currentLayer,
    totalLayer: print.totalLayer,
    printStatus: print.printStatus,
    printStatusLabel: print.printStatusLabel,
    completed: Boolean(print.completed)
  };
}

function readEventPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeFileName(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop()?.trim().toLowerCase() ?? value.trim().toLowerCase();
}

function progressPercentForHistoryPrint(print: CompletedPrinterHistoryItem) {
  if (print.status === "COMPLETED") return 100;
  if (typeof print.printedLayers === "number" && typeof print.totalLayers === "number" && print.totalLayers > 0) {
    return Math.min(100, Math.max(0, Math.round((print.printedLayers / print.totalLayers) * 100)));
  }
  return 0;
}

function readCentauriTelemetry(controlApiUrl: string, timeoutMs: number) {
  return new Promise<PublicPrinterTelemetry | null>((resolve) => {
    const socket = new WebSocket(controlApiUrl);
    let settled = false;
    const checkedAt = new Date();
    const finish = (telemetry: PublicPrinterTelemetry | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(telemetry);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);

    socket.on("open", () => {
      socket.send(JSON.stringify(buildCentauriStatusRefreshRequest()));
    });
    socket.on("message", (data) => {
      try {
        const telemetry = parseCentauriStatusTelemetry(JSON.parse(data.toString()), checkedAt);
        if (telemetry) finish(telemetry);
      } catch {
        // Ignore non-status frames and wait for the SDCP status message.
      }
    });
    socket.on("error", () => finish(null));
  });
}
