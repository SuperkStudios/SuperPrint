import { NextResponse } from "next/server";
import { getCentauriMjpegUrl } from "@/domain/printer-heartbeat";
import { prisma } from "@/lib/prisma";
import { getSharedPrinterFeedRelay } from "@/services/printer-camera-relay";
import { getPublicQueueState } from "@/services/queue";
import { readPrinterTelemetry, refreshPrinterHeartbeat } from "@/services/printer-heartbeat";

export const dynamic = "force-dynamic";

export async function GET() {
  const registeredPrinter = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  const [refreshed, telemetry] = registeredPrinter
    ? await Promise.all([refreshPrinterHeartbeat(registeredPrinter.id), readPrinterTelemetry(registeredPrinter.id)])
    : [null, null];
  const queue = await getPublicQueueState();
  const publicPrinter = queue.current?.printer ?? queue.printers[0] ?? null;
  const relay = getSharedPrinterFeedRelay().getState();
  const online = refreshed?.heartbeatStatus === "ONLINE" || relay.state === "connected" || relay.state === "connecting";

  return NextResponse.json({
    online,
    streamUrl: "/api/printer-feed/stream",
    fallbackHlsUrl: "/api/live/printer/main.m3u8",
    printerName: refreshed?.publicName ?? publicPrinter?.name ?? "SuperPrint cell",
    health: refreshed?.healthDescription ?? publicPrinter?.healthDescription ?? "No public printer status available",
    cameraSource: refreshed ? "proxied-mjpeg" : null,
    recording: false,
    latencyMode: "mjpeg-direct",
    relay,
    heartbeatAt: refreshed?.lastHeartbeatAt,
    heartbeatLatencyMs: refreshed?.heartbeatLatencyMs,
    telemetry: telemetry ?? { state: "WAITING_FOR_TELEMETRY" },
    privateCameraUrlConfigured: refreshed ? Boolean(getCentauriMjpegUrl({ internalIp: refreshed.internalIp, cameraSource: refreshed.cameraSource })) : false
  });
}
