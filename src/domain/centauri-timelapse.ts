import path from "node:path";

type TimelapseStatus = "NOT_SHOT" | "READY" | "DELETED" | "GENERATING" | "FAILED" | "UNKNOWN";

export type CentauriTimelapseRecord = {
  taskId?: string;
  taskName?: string;
  completedAt?: string;
  durationSec?: number;
  status: TimelapseStatus;
  url?: string;
};

export function extractCentauriTimelapseRecords(messages: unknown[]): CentauriTimelapseRecord[] {
  const records: CentauriTimelapseRecord[] = [];
  for (const message of messages) {
    for (const value of walk(message)) {
      if (!isRecord(value) || !hasTimelapseFields(value)) continue;
      records.push({
        taskId: readString(value, ["TaskId", "TaskID", "Id", "taskId", "id"]),
        taskName: readString(value, ["TaskName", "FileName", "Name", "taskName", "fileName", "name"]),
        completedAt: readCompletedAt(value),
        durationSec: readNestedNumber(value, [["SliceInformation", "print_time"], ["SliceInformation", "printTime"]]),
        status: normalizeTimelapseStatus(readNumber(value, ["TimeLapseVideoStatus", "timeLapseVideoStatus"])),
        url: readString(value, ["TimeLapseVideoUrl", "timeLapseVideoUrl"])
      });
    }
  }
  return dedupeTimelapses(records);
}

export function selectTimelapseForPrintJob(
  records: CentauriTimelapseRecord[],
  print: { gcodePath?: string | null; startedAt?: Date | null; completedAt?: Date | null }
) {
  const gcodeName = print.gcodePath ? path.basename(print.gcodePath) : null;
  const startedAt = print.startedAt?.getTime();
  const completedAt = print.completedAt?.getTime();
  const lowerBound = typeof startedAt === "number" ? startedAt - 10 * 60 * 1000 : undefined;
  const upperBound = typeof completedAt === "number" ? completedAt + 45 * 60 * 1000 : undefined;

  return records
    .filter((record) => record.status === "READY" && Boolean(record.url))
    .map((record) => ({ record, score: scoreTimelapse(record, { gcodeName, lowerBound, upperBound }) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.record ?? null;
}

function scoreTimelapse(
  record: CentauriTimelapseRecord,
  input: { gcodeName: string | null; lowerBound?: number; upperBound?: number }
) {
  let score = 0;
  if (input.gcodeName && record.taskName) {
    const taskName = path.basename(record.taskName);
    if (taskName === input.gcodeName) score += 100;
    else if (taskName.replace(/\.(gcode|gco|g)$/i, "") === input.gcodeName.replace(/\.(gcode|gco|g)$/i, "")) score += 60;
    else return -1;
  }
  const completedAt = record.completedAt ? Date.parse(record.completedAt) : undefined;
  if (typeof completedAt === "number" && Number.isFinite(completedAt)) {
    if (input.lowerBound && completedAt < input.lowerBound) return -1;
    if (input.upperBound && completedAt > input.upperBound) return -1;
    score += 40;
    if (input.upperBound) score += Math.max(0, 20 - Math.floor((input.upperBound - completedAt) / 60_000));
  }
  return score;
}

function dedupeTimelapses(records: CentauriTimelapseRecord[]) {
  const seen = new Set<string>();
  const unique: CentauriTimelapseRecord[] = [];
  for (const record of records) {
    const key = record.url ?? record.taskId ?? `${record.taskName}:${record.completedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function normalizeTimelapseStatus(status?: number): TimelapseStatus {
  if (status === 0) return "NOT_SHOT";
  if (status === 1) return "READY";
  if (status === 2) return "DELETED";
  if (status === 3) return "GENERATING";
  if (status === 4) return "FAILED";
  return "UNKNOWN";
}

function readCompletedAt(task: Record<string, unknown>) {
  const raw = readNumber(task, ["EndTime", "FinishTime", "CompleteTime", "endTime", "finishTime", "completeTime"]);
  if (!raw) return undefined;
  return new Date(raw > 10_000_000_000 ? raw : raw * 1000).toISOString();
}

function hasTimelapseFields(value: Record<string, unknown>) {
  return "TimeLapseVideoStatus" in value || "TimeLapseVideoUrl" in value || "timeLapseVideoStatus" in value || "timeLapseVideoUrl" in value;
}

function readString(task: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = task[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readNumber(task: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = task[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function readNestedNumber(task: Record<string, unknown>, paths: string[][]) {
  for (const nestedPath of paths) {
    let value: unknown = task;
    for (const key of nestedPath) {
      value = isRecord(value) ? value[key] : undefined;
    }
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
