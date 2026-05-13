import WebSocket from "ws";
import {
  buildCentauriHistoryDetailRequest,
  buildCentauriHistoryListRequest,
  extractCentauriTaskIds,
  extractCentauriTasks,
  normalizeCentauriTask,
  parseGcodeFilamentGrams
} from "@/domain/centauri-history";
import { filterCompletedPrinterHistory } from "@/domain/filament-usage";

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
  const completed = extractCentauriTasks(messages)
    .map((task, index) => normalizeCentauriTask(task, index))
    .filter((task) => task.status === "COMPLETED");

  const enriched = await Promise.all(
    completed.map(async (task) => ({
      ...task,
      gramsUsed: task.gramsUsed ?? (input.enrichGcode === false ? undefined : await fetchGcodeFilamentGrams(printerBaseUrl, task.name, gcodeTimeoutMs))
    }))
  );

  return input.includeMissingGrams ? enriched : filterCompletedPrinterHistory(enriched);
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

async function fetchGcodeFilamentGrams(printerBaseUrl: string, taskName: string, timeoutMs: number) {
  if (!taskName.startsWith("/")) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${printerBaseUrl}${encodeURI(taskName)}`, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!response.ok) return undefined;
    return parseGcodeFilamentGrams(await response.text());
  } catch {
    return undefined;
  }
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
    let listRequested = false;
    let detailRequested = false;
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
    const requestList = () => {
      if (settled || listRequested) return;
      listRequested = true;
      socket.send(JSON.stringify(buildCentauriHistoryListRequest(mainboardId ?? "0000000000000000")));
    };
    const requestDetails = (taskIds: string[]) => {
      if (settled || detailRequested || taskIds.length === 0) return;
      detailRequested = true;
      socket.send(JSON.stringify(buildCentauriHistoryDetailRequest(mainboardId ?? "0000000000000000", taskIds.slice(0, 10))));
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
        if (mainboardId) requestList();
        const cmd = readResponseCmd(message);
        if (cmd === 320) requestDetails(extractCentauriTaskIds(messages));
        if (cmd === 321 && extractCentauriTasks(messages).length > 0) {
          finish(() => resolve(messages));
        }
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

function readResponseCmd(value: unknown) {
  return readNestedCmd(value);
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
