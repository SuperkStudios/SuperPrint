import WebSocket from "ws";
import {
  buildCentauriHistoryDetailRequest,
  buildCentauriHistoryListRequest,
  extractCentauriTaskIds,
  extractCentauriTasks,
  normalizeCentauriTask,
  parseGcodeFilamentDensity,
  parseGcodeFilamentGrams
} from "@/domain/centauri-history";
import { filterCompletedPrinterHistory, type CompletedPrinterHistoryItem } from "@/domain/filament-usage";

const GCODE_HEAD_BYTES = 256 * 1024;
const GCODE_TAIL_BYTES = 2 * 1024 * 1024;
const HISTORY_PAGE_SIZE = 50;
const MAX_HISTORY_PAGES = 200;

export async function fetchCentauriCompletedHistory(input: {
  controlApiUrl: string;
  mainboardId?: string;
  timeoutMs?: number;
  gcodeTimeoutMs?: number;
  includeMissingGrams?: boolean;
  enrichGcode?: boolean;
}) {
  const timeoutMs = input.timeoutMs ?? 15000;
  const gcodeTimeoutMs = input.gcodeTimeoutMs ?? 8000;
  const messages = await collectHistorySessionWithRetry({
    controlApiUrl: input.controlApiUrl,
    mainboardId: input.mainboardId,
    timeoutMs
  });

  const printerBaseUrl = toPrinterBaseUrl(input.controlApiUrl);
  const history = extractCentauriTasks(messages)
    .map((task, index) => normalizeCentauriTask(task, index))
    .filter((task) => ["COMPLETED", "FAILED", "STOPPED"].includes(task.status));

  const enriched = await Promise.all(
    history.map(async (task) => {
      const metadata = input.enrichGcode === false ? undefined : await fetchGcodeFilamentMetadata(printerBaseUrl, task.name, gcodeTimeoutMs);
      const metadataUsage = resolveGcodeHistoryUsage(task, metadata?.gramsUsed);
      return {
        ...task,
        gramsUsed: task.gramsUsed ?? metadataUsage.gramsUsed,
        gramsSource: task.gramsSource ?? metadataUsage.gramsSource,
        material: task.material ?? metadata?.material,
        density: metadata?.density
      };
    })
  );

  const estimated = estimateInterruptedUsage(enriched);
  return input.includeMissingGrams ? estimated : filterCompletedPrinterHistory(estimated);
}

export async function fetchCentauriHistoryMessages(input: {
  controlApiUrl: string;
  mainboardId?: string;
  timeoutMs?: number;
}) {
  return collectHistorySessionWithRetry({
    controlApiUrl: input.controlApiUrl,
    mainboardId: input.mainboardId,
    timeoutMs: input.timeoutMs ?? 15000
  });
}

export function resolveGcodeHistoryUsage(
  task: Pick<CompletedPrinterHistoryItem, "status" | "printedLayers" | "totalLayers">,
  fullGcodeGrams?: number
) {
  if (typeof fullGcodeGrams !== "number" || !Number.isFinite(fullGcodeGrams) || fullGcodeGrams <= 0) {
    return {} as Pick<CompletedPrinterHistoryItem, "gramsUsed" | "gramsSource">;
  }
  if (!["FAILED", "STOPPED"].includes(task.status)) {
    return { gramsUsed: fullGcodeGrams, gramsSource: "GCODE" as const };
  }
  if (typeof task.printedLayers !== "number" || typeof task.totalLayers !== "number" || task.totalLayers <= 0) {
    return { gramsUsed: fullGcodeGrams, gramsSource: "GCODE" as const };
  }
  const layerRatio = Math.max(0, Math.min(1, task.printedLayers / task.totalLayers));
  return {
    gramsUsed: Number((fullGcodeGrams * layerRatio).toFixed(2)),
    gramsSource: "LAYER_ESTIMATE" as const
  };
}

async function collectHistorySessionWithRetry(input: { controlApiUrl: string; mainboardId?: string; timeoutMs: number }) {
  let lastMessages: unknown[] = [];
  const attemptTimeoutMs = Math.min(input.timeoutMs, 8000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const messages = await collectHistorySession({ ...input, timeoutMs: attemptTimeoutMs });
    if (extractCentauriTasks(messages).length > 0) return messages;
    lastMessages = messages;
    await delay(500);
  }

  return lastMessages;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGcodeFilamentMetadata(printerBaseUrl: string, taskName: string, timeoutMs: number) {
  if (!taskName.startsWith("/")) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const text = await fetchGcodeMetadataText(`${printerBaseUrl}${encodeURI(taskName)}`, controller.signal);
    return {
      gramsUsed: parseGcodeFilamentGrams(text),
      density: parseGcodeFilamentDensity(text),
      material: parseGcodeMaterial(text)
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGcodeMetadataText(url: string, signal?: AbortSignal) {
  const headResponse = await fetch(url, {
    signal,
    headers: { Range: `bytes=0-${GCODE_HEAD_BYTES - 1}` }
  });
  if (!headResponse.ok) return "";

  const headText = await readGcodeMetadataText(headResponse, GCODE_HEAD_BYTES);
  const totalBytes = readTotalResponseBytes(headResponse);
  if (parseGcodeFilamentGrams(headText) || !totalBytes || totalBytes <= GCODE_HEAD_BYTES) return headText;

  const tailStart = Math.max(GCODE_HEAD_BYTES, totalBytes - GCODE_TAIL_BYTES);
  const tailResponse = await fetch(url, {
    signal,
    headers: { Range: `bytes=${tailStart}-${totalBytes - 1}` }
  });
  if (!tailResponse.ok) return headText;

  return `${headText}\n${await readGcodeMetadataText(tailResponse, GCODE_TAIL_BYTES)}`;
}

export async function readGcodeMetadataText(response: Response, maxBytes = GCODE_HEAD_BYTES + GCODE_TAIL_BYTES) {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (totalBytes < maxBytes) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    totalBytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  text += decoder.decode();
  return text;
}

function readTotalResponseBytes(response: Response) {
  const contentRange = response.headers.get("content-range");
  const rangeTotal = contentRange?.match(/\/(\d+)$/)?.[1];
  if (rangeTotal && Number.isFinite(Number(rangeTotal))) return Number(rangeTotal);
  const contentLength = response.headers.get("content-length");
  return contentLength && Number.isFinite(Number(contentLength)) ? Number(contentLength) : undefined;
}

function parseGcodeMaterial(gcode: string) {
  const material = gcode.match(/;\s*initial_filament\s*:\s*([^;\r\n]+)/i) ?? gcode.match(/;\s*filament_type\s*[:=]\s*([^;\r\n]+)/i);
  return material?.[1]?.trim();
}

function estimateInterruptedUsage(items: Array<CompletedPrinterHistoryItem & { density?: number }>): CompletedPrinterHistoryItem[] {
  const knownByName = new Map<string, CompletedPrinterHistoryItem & { gramsUsed: number }>();
  const knownRates = items
    .filter((item): item is CompletedPrinterHistoryItem & { gramsUsed: number; printTimeSeconds: number } => {
      return typeof item.gramsUsed === "number" && item.gramsUsed > 0 && typeof item.printTimeSeconds === "number" && item.printTimeSeconds > 0;
    })
    .map((item) => item.gramsUsed / item.printTimeSeconds)
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  const fallbackRate = knownRates.length ? knownRates.reduce((total, rate) => total + rate, 0) / knownRates.length : undefined;

  for (const item of items) {
    if (item.status === "COMPLETED" && typeof item.gramsUsed === "number" && item.gramsUsed > 0) {
      knownByName.set(item.name, item as CompletedPrinterHistoryItem & { gramsUsed: number });
    }
  }

  const matchedItems = items.map((item) => {
    if (typeof item.gramsUsed === "number" && item.gramsUsed > 0) return item;
    if (!["FAILED", "STOPPED"].includes(item.status)) return item;
    const matched = knownByName.get(item.name);
    if (!matched?.gramsUsed || !item.printedLayers || !item.totalLayers) return item;
    const ratio = Math.max(0, Math.min(1, item.printedLayers / item.totalLayers));
    return {
      ...item,
      gramsUsed: Number((matched.gramsUsed * ratio).toFixed(2)),
      gramsSource: "MATCHED_COMPLETED_PRINT" as const
    };
  });

  if (!fallbackRate || fallbackRate <= 0) return matchedItems;

  return matchedItems.map((item) => {
    if (typeof item.gramsUsed === "number" && item.gramsUsed > 0) return item;
    const printTimeSeconds = Number(item.printTimeSeconds ?? 0);
    if (printTimeSeconds > 0) {
      return {
        ...item,
        gramsUsed: Number((fallbackRate * printTimeSeconds).toFixed(2)),
        gramsSource: "TIME_ESTIMATE" as const
      };
    }
    return item;
  });
}

function toPrinterBaseUrl(controlApiUrl: string) {
  const url = new URL(controlApiUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.port = "";
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectHistorySession(input: { controlApiUrl: string; mainboardId?: string; timeoutMs: number }) {
  return new Promise<unknown[]>((resolve, reject) => {
    const socket = new WebSocket(input.controlApiUrl);
    const messages: unknown[] = [];
    let mainboardId = input.mainboardId;
    let listStarted = false;
    let listComplete = false;
    const listRequestOffsets = new Map<string, number>();
    const requestedDetailIds = new Set<string>();
    const detailQueue: string[] = [];
    const pendingDetailRequestIds = new Set<string>();
    const detailRequestIds = new Set<string>();
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      try {
        socket.terminate();
      } catch {
        // Ignore socket cleanup errors; the history response is already settled.
      }
      callback();
    };
    const timeout = setTimeout(() => {
      settle(() => resolve(messages));
    }, input.timeoutMs);
    const finish = (callback: () => void) => {
      clearTimeout(timeout);
      settle(callback);
    };
    const requestList = (from = 0) => {
      if (settled || listRequestOffsets.size >= MAX_HISTORY_PAGES) return;
      listStarted = true;
      const request = buildCentauriHistoryListRequest(mainboardId ?? "0000000000000000", from);
      listRequestOffsets.set(request.Data.RequestID, from);
      socket.send(JSON.stringify(request));
    };
    const queueDetails = (taskIds: string[]) => {
      let queued = 0;
      for (const taskId of taskIds) {
        if (requestedDetailIds.has(taskId)) continue;
        requestedDetailIds.add(taskId);
        detailQueue.push(taskId);
        queued += 1;
      }
      drainDetails();
      return queued;
    };
    const drainDetails = () => {
      if (settled || pendingDetailRequestIds.size > 0 || detailQueue.length === 0) {
        maybeFinish();
        return;
      }
      const nextIds = detailQueue.splice(0, 50);
      for (const batch of chunk(nextIds, 10)) {
        const request = buildCentauriHistoryDetailRequest(mainboardId ?? "0000000000000000", batch);
        detailRequestIds.add(request.Data.RequestID);
        pendingDetailRequestIds.add(request.Data.RequestID);
        socket.send(JSON.stringify(request));
      }
    };
    const maybeFinish = () => {
      if (!listComplete || pendingDetailRequestIds.size > 0 || detailQueue.length > 0) return;
      if (detailRequestIds.size > 0 || requestedDetailIds.size === 0) {
        finish(() => resolve(messages));
      }
    };

    socket.on("open", () => {
      if (mainboardId) {
        requestList();
      } else {
        setTimeout(() => requestList(), 1000);
      }
    });
    socket.on("message", (data) => {
      const text = data.toString();
      try {
        const message = JSON.parse(text);
        messages.push(message);
        mainboardId = mainboardId ?? readMainboardId(message);
        if (mainboardId && !listStarted) requestList();
        const cmd = readResponseCmd(message);
        if (cmd === 320) {
          const requestId = readResponseRequestId(message);
          const offset = requestId ? listRequestOffsets.get(requestId) ?? 0 : 0;
          const pageIds = extractCentauriTaskIds([message]);
          const queued = queueDetails(pageIds);
          const nextOffset = offset + pageIds.length;
          if (queued > 0 && pageIds.length >= HISTORY_PAGE_SIZE && listRequestOffsets.size < MAX_HISTORY_PAGES) {
            requestList(nextOffset);
          } else {
            listComplete = true;
            maybeFinish();
          }
        }
        if (cmd === 321) {
          const requestId = readResponseRequestId(message);
          if (requestId) pendingDetailRequestIds.delete(requestId);
          drainDetails();
        }
        maybeFinish();
      } catch {
        messages.push(text);
      }
    });
    socket.on("error", (error) => {
      finish(() => reject(error));
    });
    socket.on("close", () => {
      finish(() => resolve(messages));
    });
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function readResponseCmd(value: unknown) {
  return readNestedCmd(value);
}

function readResponseRequestId(value: unknown) {
  if (!isRecord(value)) return undefined;
  const data = value.Data;
  const requestId = isRecord(data) ? data.RequestID : undefined;
  return typeof requestId === "string" ? requestId : undefined;
}

function readNestedCmd(value: unknown) {
  if (!isRecord(value)) return undefined;
  const data = value.Data;
  if (isRecord(data) && typeof data.Cmd === "number") return data.Cmd;
  return undefined;
}

function readMainboardId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const data = isRecord(value.Data) ? value.Data : undefined;
  const attributes = isRecord(value.Attributes) ? value.Attributes : undefined;
  const mainboardId = data?.MainboardID ?? attributes?.MainboardID ?? value.MainboardID;
  if (typeof mainboardId === "string" && mainboardId.trim()) return mainboardId;
  if (typeof value.Topic === "string") {
    const match = value.Topic.match(/sdcp\/(?:attributes|status|response|request)\/([^/]+)/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}
