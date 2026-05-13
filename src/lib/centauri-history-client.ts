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
  const mainboardId = input.mainboardId ?? "0000000000000000";
  const timeoutMs = input.timeoutMs ?? 15000;
  const gcodeTimeoutMs = input.gcodeTimeoutMs ?? 8000;
  const messages = await collectSdcpMessages({
    controlApiUrl: input.controlApiUrl,
    timeoutMs,
    requests: [buildCentauriHistoryListRequest(mainboardId)]
  });
  const taskIds = extractCentauriTaskIds(messages).slice(0, 10);

  const detailMessages = taskIds.length
    ? await collectSdcpMessages({
        controlApiUrl: input.controlApiUrl,
        timeoutMs,
        requests: [buildCentauriHistoryDetailRequest(findMainboardId(messages) ?? mainboardId, taskIds)]
      })
    : [];

  const printerBaseUrl = toPrinterBaseUrl(input.controlApiUrl);
  const completed = extractCentauriTasks([...messages, ...detailMessages])
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

function findMainboardId(messages: unknown[]) {
  for (const message of messages) {
    if (isRecord(message)) {
      const data = isRecord(message.Data) ? message.Data : undefined;
      const attributes = isRecord(message.Attributes) ? message.Attributes : undefined;
      const mainboardId = data?.MainboardID ?? attributes?.MainboardID ?? message.MainboardID;
      if (typeof mainboardId === "string" && mainboardId.trim()) return mainboardId;
    }
  }
  return undefined;
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

function collectSdcpMessages(input: { controlApiUrl: string; timeoutMs: number; requests: unknown[] }) {
  return new Promise<unknown[]>((resolve, reject) => {
    const socket = new WebSocket(input.controlApiUrl);
    const messages: unknown[] = [];
    const expectedCmds = new Set(input.requests.map(readRequestCmd).filter((cmd): cmd is number => typeof cmd === "number"));
    const seenCmds = new Set<number>();
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

    socket.on("open", () => {
      for (const request of input.requests) {
        socket.send(JSON.stringify(request));
      }
    });
    socket.on("message", (data) => {
      const text = data.toString();
      try {
        const message = JSON.parse(text);
        messages.push(message);
        const cmd = readResponseCmd(message);
        if (typeof cmd === "number") seenCmds.add(cmd);
        if (expectedCmds.size > 0 && [...expectedCmds].every((expected) => seenCmds.has(expected))) {
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

function readRequestCmd(value: unknown) {
  return readNestedCmd(value);
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
