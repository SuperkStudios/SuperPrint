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

export async function fetchCentauriCompletedHistory(input: { controlApiUrl: string; mainboardId?: string; timeoutMs?: number }) {
  const mainboardId = input.mainboardId ?? "0000000000000000";
  const timeoutMs = input.timeoutMs ?? 15000;
  const messages = await collectSdcpMessages({
    controlApiUrl: input.controlApiUrl,
    timeoutMs,
    requests: [buildCentauriHistoryListRequest(mainboardId)]
  });
  const taskIds = extractCentauriTaskIds(messages).slice(0, 25);

  const detailMessages = taskIds.length
    ? await collectSdcpMessages({
        controlApiUrl: input.controlApiUrl,
        timeoutMs,
        requests: [buildCentauriHistoryDetailRequest(findMainboardId(messages) ?? mainboardId, taskIds)]
      })
    : [];

  const printerBaseUrl = toPrinterBaseUrl(input.controlApiUrl);
  const completed = extractCentauriTasks(detailMessages)
    .map((task, index) => normalizeCentauriTask(task, index))
    .filter((task) => task.status === "COMPLETED");

  const enriched = [];
  for (const task of completed) {
    enriched.push({
      ...task,
      gramsUsed: task.gramsUsed ?? (await fetchGcodeFilamentGrams(printerBaseUrl, task.name, timeoutMs))
    });
  }

  return filterCompletedPrinterHistory(enriched);
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
    const timeout = setTimeout(() => {
      settled = true;
      socket.close();
      resolve(messages);
    }, input.timeoutMs);

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
          settled = true;
          clearTimeout(timeout);
          socket.close();
          resolve(messages);
        }
      } catch {
        messages.push(text);
      }
    });
    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    socket.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(messages);
    });
  });
}

function readRequestCmd(value: unknown) {
  if (!isRecord(value)) return undefined;
  const data = isRecord(value.Data) ? value.Data : undefined;
  return typeof data?.Cmd === "number" ? data.Cmd : undefined;
}

function readResponseCmd(value: unknown) {
  if (!isRecord(value)) return undefined;
  const data = isRecord(value.Data) ? value.Data : undefined;
  return typeof data?.Cmd === "number" ? data.Cmd : undefined;
}
