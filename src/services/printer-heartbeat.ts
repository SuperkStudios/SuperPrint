import http from "node:http";
import https from "node:https";
import WebSocket from "ws";
import {
  buildCentauriStatusRefreshRequest,
  buildPrinterHeartbeatUpdate,
  getCentauriMjpegUrl,
  parseCentauriStatusTelemetry,
  type PublicPrinterTelemetry
} from "@/domain/printer-heartbeat";
import { probePrinterConnection } from "@/domain/bootstrap";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

export async function refreshPrinterHeartbeat(printerId: string) {
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId } });
  const startedAt = Date.now();
  const [result, cameraReachable] = await Promise.all([
    probePrinterConnection(
      { internalIp: printer.internalIp, controlApiUrl: printer.controlApiUrl },
      { timeoutMs: 1500 }
    ),
    probeCameraReachable(getCentauriMjpegUrl({ internalIp: printer.internalIp, cameraSource: printer.cameraSource }), 5000)
  ]);
  const update = buildPrinterHeartbeatUpdate({
    ok: result.ok || cameraReachable,
    message: result.ok ? result.message : cameraReachable ? "Printer camera endpoint reachable." : result.message,
    checkedAt: new Date(),
    latencyMs: Date.now() - startedAt
  });

  return prisma.printer.update({
    where: { id: printer.id },
    data: {
      ...update,
      cameraStatus: result.ok || cameraReachable ? "ONLINE" : "OFFLINE"
    },
    include: { currentFilament: true }
  });
}

export async function refreshAllPrinterHeartbeats() {
  const printers = await prisma.printer.findMany({ orderBy: { publicName: "asc" } });
  return Promise.all(printers.map((printer) => refreshPrinterHeartbeat(printer.id)));
}

export async function readPrinterTelemetry(printerId: string): Promise<PublicPrinterTelemetry | null> {
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId } });
  if (!printer.controlApiUrl.startsWith("ws")) return null;
  const telemetry = await readCentauriTelemetry(printer.controlApiUrl, 3500);
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

function probeCameraReachable(url: string, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { timeout: timeoutMs }, (response) => {
      response.destroy();
      resolve(Boolean(response.statusCode && response.statusCode < 400));
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}
