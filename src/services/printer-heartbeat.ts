import WebSocket from "ws";
import {
  buildCentauriStatusRefreshRequest,
  buildPrinterHeartbeatUpdate,
  parseCentauriStatusTelemetry,
  type PublicPrinterTelemetry
} from "@/domain/printer-heartbeat";
import { probePrinterConnection } from "@/domain/bootstrap";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const telemetryCache = new Map<string, { telemetry: PublicPrinterTelemetry | null; checkedAtMs: number; inFlight?: Promise<PublicPrinterTelemetry | null> }>();
const TELEMETRY_CACHE_MS = 2500;

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
  if (telemetry.machineStatus !== 1 || !telemetry.currentFileName) return;
  const activeQueuedJob = await prisma.printJob.findFirst({
    where: { printerId, status: { in: ["PRINTING", "AWAITING_OPERATOR_START", "READY_ON_NODE"] } },
    select: { id: true }
  });
  if (activeQueuedJob) return;

  const key = `manualPrint.active.${printerId}`;
  const current = await prisma.systemSetting.findUnique({ where: { key } });
  if (isSameManualPrint(current?.value, telemetry.currentFileName)) return;

  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: {
        fileName: telemetry.currentFileName,
        firstSeenAt: telemetry.updatedAt,
        progressPercent: telemetry.progressPercent,
        currentLayer: telemetry.currentLayer,
        totalLayer: telemetry.totalLayer
      }
    },
    create: {
      key,
      value: {
        fileName: telemetry.currentFileName,
        firstSeenAt: telemetry.updatedAt,
        progressPercent: telemetry.progressPercent,
        currentLayer: telemetry.currentLayer,
        totalLayer: telemetry.totalLayer
      }
    }
  });

  await recordPlatformEvent({
    type: "MANUAL_PRINT_DETECTED",
    payload: {
      fileName: telemetry.currentFileName,
      progressPercent: telemetry.progressPercent,
      currentLayer: telemetry.currentLayer,
      totalLayer: telemetry.totalLayer
    }
  });
}

export function isSameManualPrint(value: unknown, fileName: string) {
  return Boolean(value && typeof value === "object" && "fileName" in value && value.fileName === fileName);
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
