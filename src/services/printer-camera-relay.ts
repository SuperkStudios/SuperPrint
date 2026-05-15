import http from "node:http";
import https from "node:https";
import { PrinterFeedRelay } from "./printer-feed-relay";

export function getSharedPrinterFeedRelay() {
  const globalState = globalThis as typeof globalThis & { __superprintPrinterFeedRelay?: PrinterFeedRelay };
  globalState.__superprintPrinterFeedRelay ??= new PrinterFeedRelay(openMjpegUpstream);
  return globalState.__superprintPrinterFeedRelay;
}

function openMjpegUpstream(url: string): Promise<{ stream: http.IncomingMessage; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { timeout: 3000 }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        response.resume();
        reject(new Error(`Printer camera stream unavailable: HTTP ${response.statusCode ?? 503}`));
        return;
      }

      resolve({
        stream: response,
        contentType: response.headers["content-type"] ?? "multipart/x-mixed-replace"
      });
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Printer camera stream timed out"));
    });
    request.on("error", reject);
  });
}
