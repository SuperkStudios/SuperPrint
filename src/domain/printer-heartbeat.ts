export function buildPrinterHeartbeatUpdate(input: {
  ok: boolean;
  message: string;
  checkedAt: Date;
  latencyMs: number;
}) {
  if (input.ok) {
    return {
      heartbeatStatus: "ONLINE" as const,
      status: "HEALTHY" as const,
      lastHeartbeatAt: input.checkedAt,
      heartbeatLatencyMs: input.latencyMs,
      healthDescription: "Online. Printer endpoint reachable."
    };
  }

  return {
    heartbeatStatus: "OFFLINE" as const,
    status: "OFFLINE" as const,
    lastHeartbeatAt: input.checkedAt,
    heartbeatLatencyMs: input.latencyMs,
    healthDescription: "Offline. Printer endpoint is not reachable."
  };
}

export function getCentauriMjpegUrl(input: { internalIp: string; cameraSource?: string | null }) {
  return input.cameraSource?.trim() || `http://${input.internalIp}:3031/video`;
}

export function buildCentauriVideoEnableRequest(mainboardId = "0000000000000000", requestId = generateCentauriRequestId(), timestamp = Date.now()) {
  return {
    Id: mainboardId,
    Data: {
      Cmd: 386,
      Data: { Enable: 1 },
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: timestamp,
      From: 1
    },
    Topic: ""
  };
}

export function buildCentauriStatusRefreshRequest(mainboardId = "0000000000000000", requestId = generateCentauriRequestId(), timestamp = Date.now()) {
  return {
    Id: mainboardId,
    Data: {
      Cmd: 0,
      Data: {},
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: timestamp,
      From: 1
    },
    Topic: ""
  };
}

type SdcpRecord = Record<string, unknown>;

export type PublicPrinterTelemetry = {
  state: "LIVE";
  source: "centauri-sdcp";
  machineStatus: number | null;
  machineStatusLabel: string;
  printStatus: number | null;
  printStatusLabel: string;
  nozzleTempC: number | null;
  nozzleTargetC: number | null;
  bedTempC: number | null;
  bedTargetC: number | null;
  chamberTempC: number | null;
  chamberTargetC: number | null;
  progressPercent: number | null;
  currentLayer: number | null;
  totalLayer: number | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  printSpeedPercent: number | null;
  currentFileName: string | null;
  updatedAt: string;
};

export function parseCentauriStatusTelemetry(message: unknown, checkedAt = new Date()): PublicPrinterTelemetry | null {
  const status = findRecordByKey(message, "Status");
  if (!status) return null;
  const printInfo = asRecord(status.PrintInfo);
  const currentTicks = readNumber(printInfo?.CurrentTicks);
  const totalTicks = readNumber(printInfo?.TotalTicks);
  const elapsedSeconds = currentTicks == null ? null : Math.round(currentTicks);
  const currentLayer = readNumber(printInfo?.CurrentLayer);
  const totalLayer = readNumber(printInfo?.TotalLayer);
  const progressFromTicks = currentTicks != null && totalTicks ? Math.round((currentTicks / totalTicks) * 100) : null;
  const progressFromLayers = currentLayer != null && totalLayer ? Math.round((currentLayer / totalLayer) * 100) : null;
  const machineStatus = readNumber(Array.isArray(status.CurrentStatus) ? status.CurrentStatus[0] : status.CurrentStatus);
  const printStatus = readNumber(printInfo?.Status);
  const remainingSeconds = isFinishedPrintStatus(printStatus)
    ? 0
    : currentTicks != null && totalTicks != null ? Math.round(Math.max(0, totalTicks - currentTicks)) : null;
  const progressPercent = isFinishedPrintStatus(printStatus)
    ? 100
    : clampPercent(progressFromTicks ?? progressFromLayers);

  return {
    state: "LIVE",
    source: "centauri-sdcp",
    machineStatus,
    machineStatusLabel: machineStatusLabel(machineStatus),
    printStatus,
    printStatusLabel: printStatusLabel(printStatus),
    nozzleTempC: roundOne(readNumber(status.TempOfNozzle)),
    nozzleTargetC: roundOne(readNumber(status.TempTargetNozzle)),
    bedTempC: roundOne(readNumber(status.TempOfHotbed)),
    bedTargetC: roundOne(readNumber(status.TempTargetHotbed)),
    chamberTempC: roundOne(readNumber(status.TempOfBox)),
    chamberTargetC: roundOne(readNumber(status.TempTargetBox)),
    progressPercent,
    currentLayer,
    totalLayer,
    elapsedSeconds,
    remainingSeconds,
    printSpeedPercent: readNumber(printInfo?.PrintSpeed) ?? readNumber(status.PrintSpeed),
    currentFileName: safeFileName(readString(printInfo, ["Filename", "FileName", "TaskName", "Name", "filename", "fileName", "taskName"])),
    updatedAt: checkedAt.toISOString()
  };
}

function findRecordByKey(input: unknown, key: string, depth = 0): SdcpRecord | null {
  if (depth > 6 || !input || typeof input !== "object") return null;
  const record = input as SdcpRecord;
  const direct = asRecord(record[key]);
  if (direct) return direct;
  for (const value of Object.values(record)) {
    const found = findRecordByKey(value, key, depth + 1);
    if (found) return found;
  }
  return null;
}

function asRecord(value: unknown): SdcpRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SdcpRecord) : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(record: SdcpRecord | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function safeFileName(value: string | null) {
  if (!value) return null;
  const clean = value.split(/[\\/]/).filter(Boolean).pop()?.trim();
  return clean || null;
}

function roundOne(value: number | null) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function clampPercent(value: number | null) {
  return value == null ? null : Math.min(100, Math.max(0, value));
}

function machineStatusLabel(status: number | null) {
  const labels: Record<number, string> = {
    0: "Idle",
    1: "Printing",
    2: "File transferring",
    3: "Calibrating",
    4: "Device testing"
  };
  return status == null ? "Unknown" : labels[status] ?? `Status ${status}`;
}

function printStatusLabel(status: number | null) {
  const labels: Record<number, string> = {
    0: "Idle",
    1: "Homing",
    5: "Pausing",
    6: "Paused",
    7: "Stopping",
    8: "Stopped",
    9: "Complete",
    10: "File checking",
    13: "Printing"
  };
  return status == null ? "Unknown" : labels[status] ?? `Print status ${status}`;
}

function isFinishedPrintStatus(status: number | null) {
  return status === 9;
}

function generateCentauriRequestId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}
