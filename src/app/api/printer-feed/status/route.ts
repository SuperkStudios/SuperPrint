import { NextResponse } from "next/server";
import { getCentauriMjpegUrl } from "@/domain/printer-heartbeat";
import { prisma } from "@/lib/prisma";
import { getSharedPrinterFeedRelay } from "@/services/printer-camera-relay";
import { getRecentSuperNodeCameraFrame } from "@/services/supernode-camera-frames";
import { getPublicQueueState } from "@/services/queue";
import { readPrinterTelemetry, refreshPrinterHeartbeat } from "@/services/printer-heartbeat";

export const dynamic = "force-dynamic";

export async function GET() {
  const mediaRelay = getMediaRelayPlayback();
  const registeredPrinter = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  const [refreshed, telemetry] = registeredPrinter
    ? await Promise.all([refreshPrinterHeartbeat(registeredPrinter.id), readPrinterTelemetry(registeredPrinter.id)])
    : [null, null];
  const queue = await getPublicQueueState();
  const publicPrinter = queue.current?.printer ?? queue.printers[0] ?? null;
  const relay = getSharedPrinterFeedRelay().getState();
  const superNodeFrame = refreshed ? getRecentSuperNodeCameraFrame(refreshed.id) : null;
  const online = Boolean(mediaRelay) || refreshed?.heartbeatStatus === "ONLINE" || Boolean(superNodeFrame) || relay.state === "connected" || relay.state === "connecting";

  return NextResponse.json({
    online,
    streamUrl: mediaRelay?.streamUrl ?? "/api/printer-feed/stream",
    fallbackHlsUrl: mediaRelay?.hlsUrl ?? "/api/live/printer/main.m3u8",
    printerName: refreshed?.publicName ?? publicPrinter?.name ?? "SuperPrint cell",
    health: refreshed?.healthDescription ?? publicPrinter?.healthDescription ?? "No public printer status available",
    cameraSource: mediaRelay?.source ?? (superNodeFrame ? "supernode-mjpeg" : refreshed ? "proxied-mjpeg" : null),
    recording: false,
    latencyMode: mediaRelay?.latencyMode ?? "mjpeg-direct",
    relay,
    mediaRelay,
    superNodeCamera: superNodeFrame
      ? {
          nodeId: superNodeFrame.nodeId,
          receivedAt: superNodeFrame.receivedAt,
          ageMs: Date.now() - superNodeFrame.receivedAt.getTime()
        }
      : null,
    heartbeatAt: refreshed?.lastHeartbeatAt,
    heartbeatLatencyMs: refreshed?.heartbeatLatencyMs,
    telemetry: telemetry ?? { state: "WAITING_FOR_TELEMETRY" },
    privateCameraUrlConfigured: refreshed ? Boolean(getCentauriMjpegUrl({ internalIp: refreshed.internalIp, cameraSource: refreshed.cameraSource })) : false
  });
}

function getMediaRelayPlayback() {
  const webrtcUrl = process.env.PUBLIC_PRINTER_WEBRTC_URL?.trim();
  const hlsUrl = process.env.PUBLIC_PRINTER_HLS_URL?.trim();
  const streamUrl = webrtcUrl || hlsUrl;
  if (!streamUrl) return null;
  return {
    source: webrtcUrl ? "mediamtx-webrtc" : "mediamtx-hls",
    streamUrl,
    hlsUrl: hlsUrl || null,
    webrtcUrl: webrtcUrl || null,
    latencyMode: webrtcUrl ? "webrtc" : "low-latency-hls"
  };
}
