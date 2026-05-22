import WebSocket from "ws";
import { buildCentauriVideoEnableRequest, getCentauriMjpegUrl } from "@/domain/printer-heartbeat";
import { prisma } from "@/lib/prisma";
import { getSharedPrinterFeedRelay } from "@/services/printer-camera-relay";
import { createSuperNodeCameraFrameStream, getRecentSuperNodeCameraFrame } from "@/services/supernode-camera-frames";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const printer = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  if (!printer) {
    return new Response("No printer registered", { status: 404 });
  }

  if (getRecentSuperNodeCameraFrame(printer.id)) {
    const activeStream = createSuperNodeCameraFrameStream(printer.id);
    return new Response(activeStream.stream, {
      headers: {
        "Content-Type": activeStream.contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache"
      }
    });
  }

  const activeStream = await getSharedPrinterFeedRelay().openClient(getCentauriMjpegUrl({ internalIp: printer.internalIp, cameraSource: printer.cameraSource }), {
    beforeConnect: printer.controlApiUrl.startsWith("ws") ? () => enableCentauriVideo(printer.controlApiUrl).catch(() => undefined) : undefined
  }).catch(() => null);
  if (!activeStream) {
    return new Response("Printer camera stream unavailable", { status: 503 });
  }

  return new Response(activeStream.stream, {
    headers: {
      "Content-Type": activeStream.contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache"
    }
  });
}

function enableCentauriVideo(controlApiUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(controlApiUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Centauri video enable timed out"));
    }, 2500);

    socket.on("open", () => {
      socket.send(JSON.stringify(buildCentauriVideoEnableRequest()));
    });
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as { Data?: { Cmd?: number; Data?: { Ack?: number } } };
        if (message.Data?.Cmd === 386) {
          clearTimeout(timeout);
          socket.close();
          message.Data.Data?.Ack === 0 ? resolve() : reject(new Error("Centauri rejected video enable"));
        }
      } catch {
        // Ignore unrelated non-JSON frames.
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.on("close", () => clearTimeout(timeout));
  });
}
