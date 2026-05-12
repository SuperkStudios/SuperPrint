import type { CompletedPrinterHistoryItem } from "./filament-usage";
import { filterCompletedPrinterHistory } from "./filament-usage";

type CentauriTask = Record<string, unknown>;

export function extractCompletedCentauriHistory(tasks: CentauriTask[]): CompletedPrinterHistoryItem[] {
  return filterCompletedPrinterHistory(tasks.map((task, index) => normalizeCentauriTask(task, index)));
}

export function normalizeCentauriTask(task: CentauriTask, index = 0): CompletedPrinterHistoryItem {
  const statusCode = readNumber(task, ["Status", "TaskStatus", "status", "taskStatus"]);
  return {
    id: readString(task, ["Id", "TaskId", "TaskID", "id", "taskId"]) ?? `centauri-task-${index}`,
    name: readString(task, ["TaskName", "FileName", "Name", "taskName", "fileName", "name"]) ?? "Completed print",
    status: statusCode === 1 ? "COMPLETED" : "OTHER",
    gramsUsed: readNumber(task, ["FilamentUsed", "FilamentWeight", "MaterialUsed", "filamentUsed", "filamentWeight", "materialUsed"]),
    completedAt: readCompletedAt(task)
  };
}

export function buildCentauriHistoryListRequest(mainboardId: string) {
  const requestId = crypto.randomUUID();
  return {
    Id: requestId,
    Data: {
      Cmd: 320,
      Data: {},
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: Math.floor(Date.now() / 1000),
      From: 0
    },
    Topic: `sdcp/request/${mainboardId}`
  };
}

export function buildCentauriHistoryDetailRequest(mainboardId: string, taskIds: string[]) {
  const requestId = crypto.randomUUID();
  return {
    Id: requestId,
    Data: {
      Cmd: 321,
      Data: { Id: taskIds },
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: Math.floor(Date.now() / 1000),
      From: 0
    },
    Topic: `sdcp/request/${mainboardId}`
  };
}

export function extractCentauriTaskIds(messages: unknown[]) {
  const ids: string[] = [];
  for (const message of messages) {
    for (const value of walk(message)) {
      if (isRecord(value) && Array.isArray(value.HistoryData)) {
        for (const id of value.HistoryData) {
          if (typeof id === "string" && id.trim()) ids.push(id);
        }
      }
    }
  }
  return [...new Set(ids)].slice(0, 50);
}

export function extractCentauriTasks(messages: unknown[]) {
  const tasks: CentauriTask[] = [];
  for (const message of messages) {
    for (const value of walk(message)) {
      if (isRecord(value) && hasAnyKey(value, ["Status", "TaskStatus", "TaskName", "FileName", "FilamentUsed", "MaterialUsed", "TaskId"])) {
        tasks.push(value);
      }
    }
  }
  return tasks;
}

function readCompletedAt(task: CentauriTask) {
  const raw = readNumber(task, ["EndTime", "FinishTime", "CompleteTime", "endTime", "finishTime", "completeTime"]);
  if (!raw) return undefined;
  const millis = raw > 10_000_000_000 ? raw : raw * 1000;
  return new Date(millis).toISOString();
}

function readString(task: CentauriTask, keys: string[]) {
  for (const key of keys) {
    const value = task[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readNumber(task: CentauriTask, keys: string[]) {
  for (const key of keys) {
    const value = task[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function* walk(value: unknown): Generator<unknown> {
  yield value;
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) yield* walk(item);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAnyKey(value: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => key in value);
}

export function parseGcodeFilamentGrams(gcode: string) {
  const direct = gcode.match(/;\s*(?:total\s+)?filament used \[g\]\s*=\s*([0-9.]+)/i);
  if (direct) return Number(direct[1]);

  const length = gcode.match(/;\s*filament used \[mm\]\s*=\s*([0-9.]+)/i);
  const density = gcode.match(/;\s*filament_density:\s*([0-9.]+)/i) ?? gcode.match(/;\s*filament_density\s*=\s*([0-9.]+)/i);
  const diameter = gcode.match(/;\s*filament_diameter:\s*([0-9.]+)/i) ?? gcode.match(/;\s*filament_diameter\s*=\s*([0-9.]+)/i);
  if (!length || !density || !diameter) return undefined;

  const radiusCm = Number(diameter[1]) / 20;
  const lengthCm = Number(length[1]) / 10;
  const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
  return Number((volumeCm3 * Number(density[1])).toFixed(2));
}
