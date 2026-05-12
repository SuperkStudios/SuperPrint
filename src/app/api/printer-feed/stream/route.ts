import http from "node:http";
import https from "node:https";
import WebSocket from "ws";
import { buildCentauriVideoEnableRequest, getCentauriMjpegUrl } from "@/domain/printer-heartbeat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const printer = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  if (!printer) {
    return new Response("No printer registered", { status: 404 });
  }

  if (printer.controlApiUrl.startsWith("ws")) {
    enableCentauriVideo(printer.controlApiUrl).catch(() => undefined);
  }
  const activeStream = await openMjpegStream(getCentauriMjpegUrl({ internalIp: printer.internalIp, cameraSource: printer.cameraSource }));
  if (!activeStream.ok) {
    return new Response("Printer camera stream unavailable", { status: activeStream.status });
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

function openMjpegStream(url: string): Promise<{ ok: true; stream: ReadableStream<Uint8Array>; contentType: string } | { ok: false; status: number }> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { timeout: 3000 }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        response.resume();
        resolve({ ok: false, status: response.statusCode ?? 503 });
        return;
      }

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          response.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          response.on("end", () => controller.close());
          response.on("error", (error) => controller.error(error));
        },
        cancel() {
          request.destroy();
        }
      });

      resolve({
        ok: true,
        stream,
        contentType: response.headers["content-type"] ?? "multipart/x-mixed-replace"
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, status: 504 });
    });
    request.on("error", () => resolve({ ok: false, status: 503 }));
  });
}
