import WebSocket from "ws";
import {
  buildCentauriHistoryDetailRequest,
  buildCentauriHistoryListRequest,
  extractCentauriTaskIds,
  extractCentauriTasks,
  extractCompletedCentauriHistory
} from "@/domain/centauri-history";

export async function fetchCentauriCompletedHistory(input: { controlApiUrl: string; mainboardId?: string; timeoutMs?: number }) {
  const mainboardId = input.mainboardId ?? "0000000000000000";
  const timeoutMs = input.timeoutMs ?? 5000;
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
        requests: taskIds.map((taskId) => buildCentauriHistoryDetailRequest(mainboardId, taskId))
      })
    : [];

  return extractCompletedCentauriHistory(extractCentauriTasks([...messages, ...detailMessages]));
}

function collectSdcpMessages(input: { controlApiUrl: string; timeoutMs: number; requests: unknown[] }) {
  return new Promise<unknown[]>((resolve, reject) => {
    const socket = new WebSocket(input.controlApiUrl);
    const messages: unknown[] = [];
    const timeout = setTimeout(() => {
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
        messages.push(JSON.parse(text));
      } catch {
        messages.push(text);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      resolve(messages);
    });
  });
}
