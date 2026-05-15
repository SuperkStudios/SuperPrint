import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import WebSocket from "ws";

export type PrinterStartCommand = {
  printJobId: string;
  gcodeLocalPath: string;
};

export type PrinterControlAdapter = {
  startPrint: (command: PrinterStartCommand) => Promise<{
    acknowledged: boolean;
    mode: string;
    message: string;
  }>;
  pausePrint?: (printJobId: string) => Promise<PrinterControlAck>;
  stopPrint?: (printJobId: string) => Promise<PrinterControlAck>;
  cooldown?: (printerId: string) => Promise<PrinterControlAck>;
};

export type PrinterControlAck = {
  acknowledged: boolean;
  mode: string;
  message: string;
};

export function resolveCentauriUploadUrl(controlApiUrl: string) {
  const url = new URL(controlApiUrl);
  const protocol = url.protocol === "wss:" || url.protocol === "https:" ? "http:" : "http:";
  return `${protocol}//${url.hostname}:3030/uploadFile/upload`;
}

export function resolveCentauriUploadFallbackUrl(controlApiUrl: string) {
  const url = new URL(controlApiUrl);
  const protocol = url.protocol === "wss:" || url.protocol === "https:" ? "http:" : "http:";
  return `${protocol}//${url.hostname}/uploadFile/upload`;
}

export function buildCentauriStartPrintRequest(input: {
  filename: string;
  mainboardId?: string;
  requestId?: string;
  timestamp?: number;
}) {
  const mainboardId = input.mainboardId ?? "0000000000000000";
  const requestId = input.requestId ?? generateCentauriPrinterRequestId();
  return {
    Id: mainboardId,
    Data: {
      Cmd: 128,
      Data: {
        Filename: input.filename,
        StartLayer: 0,
        Calibration_switch: 0,
        PrintPlatformType: 0,
        Tlp_Switch: 1,
        slot_map: []
      },
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: input.timestamp ?? Date.now(),
      From: 1
    },
    Topic: ""
  };
}

export function buildCentauriTimelapseEnableRequest(input: {
  enable?: boolean;
  mainboardId?: string;
  requestId?: string;
  timestamp?: number;
}) {
  return buildCentauriRequest({
    cmd: 387,
    data: { Enable: input.enable === false ? 0 : 1 },
    mainboardId: input.mainboardId,
    requestId: input.requestId,
    timestamp: input.timestamp
  });
}

export function buildCentauriTimelapseExportRequest(input: {
  path: string;
  mainboardId?: string;
  requestId?: string;
  timestamp?: number;
}) {
  return buildCentauriRequest({
    cmd: 323,
    data: { Url: [input.path] },
    mainboardId: input.mainboardId,
    requestId: input.requestId,
    timestamp: input.timestamp
  });
}

export function buildCentauriRequest(input: {
  cmd: number;
  data?: Record<string, unknown>;
  mainboardId?: string;
  requestId?: string;
  timestamp?: number;
}) {
  const mainboardId = input.mainboardId ?? "0000000000000000";
  const requestId = input.requestId ?? generateCentauriPrinterRequestId();
  return {
    Id: mainboardId,
    Data: {
      Cmd: input.cmd,
      Data: input.data ?? {},
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: input.timestamp ?? Date.now(),
      From: 1
    },
    Topic: ""
  };
}

export function buildCentauriPrinterFilename(gcodeLocalPath: string) {
  return path.basename(gcodeLocalPath);
}

export function prepareCentauriTimelapseGcode(file: Buffer) {
  if (file.includes(0)) return file;
  const text = file.toString("utf8");
  if (/SET_PRINT_STATS_INFO\s+(?:TOTAL_LAYER|CURRENT_LAYER)=/i.test(text)) return file;

  const lines = text.split(/\r?\n/);
  const markerIndexes = lines
    .map((line, index) => (/^;\s*(?:LAYER_CHANGE|CHANGE_LAYER)\b/i.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const totalLayers = readTotalLayerCount(text) ?? markerIndexes.length;
  if (!totalLayers || totalLayers <= 0) return file;

  const output = [`SET_PRINT_STATS_INFO TOTAL_LAYER=${totalLayers}`];
  let currentLayer = 0;
  for (let index = 0; index < lines.length; index += 1) {
    output.push(lines[index]);
    if (markerIndexes.includes(index)) {
      currentLayer += 1;
      output.push(`SET_PRINT_STATS_INFO CURRENT_LAYER=${currentLayer}`);
    }
  }
  return Buffer.from(output.join("\n"));
}

export function getCentauriResponseAck(message: unknown, cmd: number) {
  const data = getRecord(getRecord(message)?.Data);
  if (data?.Cmd !== cmd) return null;
  const payload = getRecord(data.Data);
  return typeof payload?.Ack === "number" ? payload.Ack : null;
}

export function describeCentauriStartAck(ack: number) {
  const descriptions: Record<number, string> = {
    0: "ok",
    1: "busy",
    2: "not found",
    3: "MD5 failed",
    4: "file I/O failed",
    5: "invalid resolution",
    6: "unknown format",
    7: "unknown model"
  };
  return descriptions[ack] ?? `unknown ACK ${ack}`;
}

export function isCentauriIdleStatus(message: unknown) {
  const root = getRecord(message);
  const status = getRecord(root?.Status) ?? getRecord(root?.last_status) ?? getRecord(getRecord(root?.Data)?.Status) ?? getRecord(getRecord(root?.Data)?.Data);
  const currentStatus = numberFrom(status?.CurrentStatus ?? status?.currentStatus);
  const printInfo = getRecord(status?.PrintInfo) ?? getRecord(status?.printInfo);
  const printStatus = numberFrom(printInfo?.Status ?? printInfo?.PrintStatus ?? status?.PrintStatus);
  const errorNumber = numberFrom(printInfo?.ErrorNumber ?? status?.ErrorNumber);
  return currentStatus === 0 && (printStatus === null || printStatus === 0) && (errorNumber === null || errorNumber === 0);
}

export function findCentauriFile(message: unknown, filename: string) {
  const data = getRecord(getRecord(getRecord(message)?.Data)?.Data);
  const fileList = Array.isArray(data?.FileList) ? data.FileList : [];
  return fileList.find((entry) => {
    const file = getRecord(entry);
    if (typeof file?.name !== "string") return false;
    return normalizeCentauriPath(file.name) === normalizeCentauriPath(filename) || path.basename(file.name) === path.basename(filename);
  }) ?? null;
}

export class ManualNoopPrinterControlAdapter implements PrinterControlAdapter {
  async startPrint(_command: PrinterStartCommand) {
    return {
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged start command; no printer API was called."
    };
  }

  async pausePrint(_printJobId: string) {
    return {
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged pause command; no printer API was called."
    };
  }

  async stopPrint(_printJobId: string) {
    return {
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged stop command; no printer API was called."
    };
  }

  async cooldown(_printerId: string) {
    return {
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged cooldown command; no printer API was called."
    };
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberFrom(value: unknown) {
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "number") return value[0];
  return typeof value === "number" ? value : null;
}

function normalizeCentauriPath(value: string) {
  return value.replace(/\/+/g, "/");
}

function generateCentauriPrinterRequestId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function readTotalLayerCount(gcode: string) {
  const direct =
    gcode.match(/;\s*total[_\s-]*layer[_\s-]*(?:count|number)\s*[:=]\s*(\d+)/i) ??
    gcode.match(/;\s*layer\s+num\/total_layer_count\s*:\s*\d+\s*\/\s*(\d+)/i);
  return direct ? Number(direct[1]) : undefined;
}

export class CentauriPrinterControlAdapter implements PrinterControlAdapter {
  constructor(private readonly input: { controlApiUrl: string; mainboardId?: string; timeoutMs?: number }) {}

  async startPrint(command: PrinterStartCommand) {
    const uploadFilename = path.basename(command.gcodeLocalPath);
    const printerFilename = buildCentauriPrinterFilename(command.gcodeLocalPath);
    const mainboardId = await assertCentauriPrinterIdle({
      controlApiUrl: this.input.controlApiUrl,
      mainboardId: this.input.mainboardId,
      timeoutMs: this.input.timeoutMs ?? 10000
    });

    const file = prepareCentauriTimelapseGcode(await readFile(command.gcodeLocalPath));
    await uploadCentauriGcode({
      urls: [resolveCentauriUploadUrl(this.input.controlApiUrl), resolveCentauriUploadFallbackUrl(this.input.controlApiUrl)],
      filename: uploadFilename,
      file
    });
    const fileList = await sendCentauriCommand({
      controlApiUrl: this.input.controlApiUrl,
      request: buildCentauriRequest({ cmd: 258, data: { Url: "/local/" }, mainboardId }),
      cmd: 258,
      timeoutMs: this.input.timeoutMs ?? 10000
    });
    const listAck = getCentauriResponseAck(fileList, 258);
    if (listAck !== 0) {
      throw new Error(`Centauri file list failed with ACK ${listAck ?? "missing"}`);
    }
    if (!findCentauriFile(fileList, printerFilename)) {
      throw new Error(`Centauri uploaded file was not found on printer storage: ${printerFilename}`);
    }

    await sendCentauriCommand({
      controlApiUrl: this.input.controlApiUrl,
      request: buildCentauriTimelapseEnableRequest({ mainboardId }),
      cmd: 387,
      timeoutMs: this.input.timeoutMs ?? 10000
    }).catch(() => undefined);

    const startResponse = await sendCentauriCommand({
      controlApiUrl: this.input.controlApiUrl,
      request: buildCentauriStartPrintRequest({ filename: printerFilename, mainboardId }),
      cmd: 128,
      timeoutMs: this.input.timeoutMs ?? 10000
    });
    const startAck = getCentauriResponseAck(startResponse, 128);
    if (startAck !== 0) {
      throw new Error(`Centauri start command failed: ${describeCentauriStartAck(startAck ?? -1)}`);
    }

    return {
      acknowledged: true,
      mode: "centauri-sdcp",
      message: `Uploaded and started ${printerFilename} on Centauri printer.`
    };
  }
}

function assertCentauriPrinterIdle(input: { controlApiUrl: string; mainboardId?: string; timeoutMs: number }) {
  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(input.controlApiUrl);
    let settled = false;
    let statusSeen = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // Ignore cleanup errors after the command settles.
      }
      callback();
    };
    const timeout = setTimeout(() => {
      if (!statusSeen) {
        settle(() => reject(new Error("Centauri idle preflight timed out before any status message was received")));
      }
    }, input.timeoutMs);
    socket.on("open", () => {
      socket.send(JSON.stringify(buildCentauriRequest({ cmd: 0, mainboardId: input.mainboardId })));
    });
    socket.on("message", (data) => {
      const message = parseCentauriMessage(data.toString());
      if (!message) return;
      if (isCentauriIdleStatus(message)) {
        statusSeen = true;
        settle(() => resolve(extractCentauriMainboardId(message) ?? input.mainboardId ?? "0000000000000000"));
        return;
      }
      if (hasCentauriNonIdleStatus(message)) {
        statusSeen = true;
        settle(() => reject(new Error("Centauri printer is not idle; automatic start blocked")));
      }
    });
    socket.on("error", (error) => settle(() => reject(error)));
  });
}

function sendCentauriCommand(input: { controlApiUrl: string; request: unknown; cmd: number; timeoutMs: number }) {
  return new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(input.controlApiUrl);
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // Ignore cleanup errors after the command settles.
      }
      callback();
    };
    const timeout = setTimeout(() => settle(() => reject(new Error(`Centauri command ${input.cmd} timed out`))), input.timeoutMs);
    socket.on("open", () => {
      socket.send(JSON.stringify(input.request));
    });
    socket.on("message", (data) => {
      const message = parseCentauriMessage(data.toString());
      if (!message) return;
      const ack = getCentauriResponseAck(message, input.cmd);
      if (ack !== null) {
        settle(() => resolve(message));
      }
    });
    socket.on("error", (error) => settle(() => reject(error)));
  });
}

async function uploadCentauriGcode(input: { urls: string[]; filename: string; file: Buffer }) {
  const errors: string[] = [];
  for (const url of input.urls) {
    try {
      await uploadCentauriGcodeChunks(url, input.filename, input.file);
      return;
    } catch (error) {
      errors.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Centauri upload failed: ${errors.join("; ")}`);
}

async function uploadCentauriGcodeChunks(url: string, filename: string, file: Buffer) {
  const transferId = randomUUID().replace(/-/g, "");
  const md5 = createHash("md5").update(file).digest("hex");
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < file.length; offset += chunkSize) {
    const chunk = file.subarray(offset, Math.min(offset + chunkSize, file.length));
    const form = new FormData();
    form.set("TotalSize", String(file.length));
    form.set("Uuid", transferId);
    form.set("Offset", String(offset));
    form.set("Check", "1");
    form.set("S-File-MD5", md5);
    form.set("File", new Blob([new Uint8Array(chunk)]), filename);

    const upload = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000)
    });
    const body = await upload.text().catch(() => "");
    if (!upload.ok || (body && !/\"success\"\s*:\s*true|000000/i.test(body))) {
      throw new Error(`chunk offset ${offset} failed with HTTP ${upload.status}${body ? `: ${body}` : ""}`);
    }
  }
}

function parseCentauriMessage(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function hasCentauriNonIdleStatus(message: unknown) {
  const root = getRecord(message);
  const status = getRecord(root?.Status) ?? getRecord(root?.last_status) ?? getRecord(getRecord(root?.Data)?.Status) ?? getRecord(getRecord(root?.Data)?.Data);
  const currentStatus = numberFrom(status?.CurrentStatus ?? status?.currentStatus);
  const printInfo = getRecord(status?.PrintInfo) ?? getRecord(status?.printInfo);
  const printStatus = numberFrom(printInfo?.Status ?? printInfo?.PrintStatus ?? status?.PrintStatus);
  const errorNumber = numberFrom(printInfo?.ErrorNumber ?? status?.ErrorNumber);
  return (currentStatus !== null && currentStatus !== 0) || (printStatus !== null && printStatus !== 0) || (errorNumber !== null && errorNumber !== 0);
}

function extractCentauriMainboardId(message: unknown) {
  const root = getRecord(message);
  const rootValue = root?.MainboardID;
  if (typeof rootValue === "string" && rootValue) return rootValue;
  const dataValue = getRecord(root?.Data)?.MainboardID;
  if (typeof dataValue === "string" && dataValue) return dataValue;
  return null;
}
