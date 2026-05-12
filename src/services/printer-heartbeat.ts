import http from "node:http";
import https from "node:https";
import { buildPrinterHeartbeatUpdate, getCentauriMjpegUrl } from "@/domain/printer-heartbeat";
import { probePrinterConnection } from "@/domain/bootstrap";
import { prisma } from "@/lib/prisma";

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
