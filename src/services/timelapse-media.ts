import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import WebSocket from "ws";
import { extractCentauriTimelapseRecords, selectTimelapseForPrintJob } from "@/domain/centauri-timelapse";
import { buildCentauriTimelapseExportRequest, getCentauriResponseAck } from "@/domain/printer-control";
import { fetchCentauriHistoryMessages } from "@/lib/centauri-history-client";
import { prisma } from "@/lib/prisma";
import { getDataRoot, resolveLocalStoragePath } from "@/lib/storage";
import { attachExistingOrderMedia } from "./media";

type CompletedPrintTimelapseInput = {
  id: string;
  orderId: string;
  orderNumber: string;
  printerControlApiUrl?: string | null;
  gcodePath?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

type TimelapseDeps = {
  dataRoot?: string;
  fetchHistoryMessages?: typeof fetchCentauriHistoryMessages;
  triggerExport?: typeof triggerCentauriTimelapseExport;
  download?: typeof downloadTimelapseBytes;
  attachExistingOrderMedia?: typeof attachExistingOrderMedia;
};

export async function attachCompletedPrintTimelapse(printJobId: string) {
  const job = await prisma.printJob.findUnique({
    where: { id: printJobId },
    include: { order: true, printer: true }
  });
  if (!job?.printer?.controlApiUrl) return { attached: false, reason: "NO_PRINTER_CONTROL_URL" };

  return downloadCompletedPrintTimelapse({
    id: job.id,
    orderId: job.orderId,
    orderNumber: job.order.orderNumber,
    printerControlApiUrl: job.printer.controlApiUrl,
    gcodePath: job.nodeLocalJobPath,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  });
}

export async function downloadCompletedPrintTimelapse(input: CompletedPrintTimelapseInput, deps: TimelapseDeps = {}) {
  if (!input.printerControlApiUrl) return { attached: false, reason: "NO_PRINTER_CONTROL_URL" };

  const historyMessages = await (deps.fetchHistoryMessages ?? fetchCentauriHistoryMessages)({
    controlApiUrl: input.printerControlApiUrl,
    timeoutMs: 15000
  });
  const record = selectTimelapseForPrintJob(extractCentauriTimelapseRecords(historyMessages), input);
  if (!record?.url) return { attached: false, reason: "TIMELAPSE_NOT_READY" };

  const exportPath = resolveTimelapseExportPath(record.url);
  const downloadUrl = resolveTimelapseDownloadUrl(record.url, input.printerControlApiUrl);
  await (deps.triggerExport ?? triggerCentauriTimelapseExport)(input.printerControlApiUrl, exportPath, 30000);

  const storageKey = `timelapses/${safeMediaFileName(input.orderNumber)}-${safeMediaFileName(input.id)}.mp4`;
  const localPath = resolveLocalStoragePath(storageKey, deps.dataRoot ?? getDataRoot());
  await mkdir(path.dirname(localPath), { recursive: true });
  const bytes = await (deps.download ?? downloadTimelapseBytes)(downloadUrl, 30000);
  await writeFile(localPath, bytes);

  await (deps.attachExistingOrderMedia ?? attachExistingOrderMedia)(input.orderId, {
    title: `Timelapse for ${input.orderNumber}`,
    videoKey: storageKey,
    timelapseKey: storageKey,
    durationSec: record.durationSec ?? Math.max(0, Math.round(((input.completedAt?.getTime() ?? 0) - (input.startedAt?.getTime() ?? 0)) / 1000))
  });

  return { attached: true, storageKey };
}

export function triggerCentauriTimelapseExport(controlApiUrl: string, timelapsePath: string, timeoutMs = 30000) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(controlApiUrl);
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // Ignore cleanup after export settles.
      }
      callback();
    };
    const timeout = setTimeout(() => settle(() => reject(new Error("Centauri timelapse export timed out"))), timeoutMs);
    socket.on("open", () => {
      socket.send(JSON.stringify(buildCentauriTimelapseExportRequest({ path: timelapsePath })));
    });
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as unknown;
        const ack = getCentauriResponseAck(message, 323);
        if (ack === 0) settle(() => resolve());
        else if (ack !== null) settle(() => reject(new Error(`Centauri timelapse export failed with ACK ${ack}`)));
      } catch {
        // Ignore unrelated non-JSON frames.
      }
    });
    socket.on("error", (error) => settle(() => reject(error)));
  });
}

async function downloadTimelapseBytes(url: string, timeoutMs = 30000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Timelapse download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function safeMediaFileName(value: string) {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function resolveTimelapseExportPath(urlOrPath: string) {
  if (/^https?:\/\//i.test(urlOrPath)) return new URL(urlOrPath).pathname;
  return urlOrPath.startsWith("/") ? urlOrPath : `/local/aic_tlp/${urlOrPath}`;
}

function resolveTimelapseDownloadUrl(urlOrPath: string, controlApiUrl: string) {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  const controlUrl = new URL(controlApiUrl);
  return `http://${controlUrl.hostname}${resolveTimelapseExportPath(urlOrPath)}`;
}
