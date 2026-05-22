import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import WebSocket from "ws";
import { signNodeHeartbeat } from "../../src/domain/supernode-auth";

const apiBaseUrl = process.env.SUPERPRINT_API_URL ?? "http://app:3000";
const nodeId = process.env.SUPERNODE_ID ?? "supernode-local";
const nodeSecret = process.env.SUPERNODE_SECRET;
const printerId = process.env.SUPERNODE_PRINTER_ID;
const printerControlUrl = process.env.SUPERNODE_PRINTER_CONTROL_URL;
const printerCameraUrl = process.env.SUPERNODE_PRINTER_CAMERA_URL;
const heartbeatIntervalMs = Number(process.env.SUPERNODE_HEARTBEAT_INTERVAL_MS ?? 15000);
const cameraFrameIntervalMs = Number(process.env.SUPERNODE_CAMERA_FRAME_INTERVAL_MS ?? 100);
const mediaPushUrl = process.env.SUPERNODE_MEDIA_PUSH_URL?.trim();
const mediaSourceUrl = process.env.SUPERNODE_MEDIA_SOURCE_URL?.trim() || printerCameraUrl;
const mediaFps = Number(process.env.SUPERNODE_MEDIA_FPS ?? 15);
const mediaBitrate = process.env.SUPERNODE_MEDIA_BITRATE?.trim() || "1200k";
const mediaScale = process.env.SUPERNODE_MEDIA_SCALE?.trim() || "1280:-2";
const nodeJobsDir = process.env.SUPERNODE_JOBS_PATH ?? "/data/node-jobs";

if (!nodeSecret) {
  throw new Error("SUPERNODE_SECRET is required after registration");
}
const nodeSigningSecret = nodeSecret;

let retryCount = 0;
let latestCameraFrameAt = 0;
let cameraFrameUploadInFlight = false;
let cameraBridgeLastFrameAt = 0;
let cameraBridgeLastError: string | null = null;
let mediaRelayLastError: string | null = null;

async function sendHeartbeat() {
  const printerHealth = await probeConfiguredPrinter();
  const cameraBridgeError = getCameraBridgeHeartbeatError();
  const payload = {
    nodeId,
    printerId,
    timestamp: new Date().toISOString(),
    heartbeatStatus: "ONLINE",
    printerStatus: printerHealth.printerStatus,
    cameraStatus: printerHealth.cameraStatus,
    localPaths: {
      uploads: process.env.SUPERNODE_UPLOADS_PATH ?? "/data/uploads",
      sliced: process.env.SUPERNODE_SLICED_PATH ?? "/data/sliced",
      videos: process.env.SUPERNODE_VIDEOS_PATH ?? "/data/videos",
      timelapses: process.env.SUPERNODE_TIMELAPSES_PATH ?? "/data/timelapses",
      thumbnails: process.env.SUPERNODE_THUMBNAILS_PATH ?? "/data/thumbnails"
    },
    retryCount,
    lastError: cameraBridgeError
  };
  const body = JSON.stringify(payload);
  const response = await fetch(`${apiBaseUrl}/api/supernode/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${nodeSigningSecret}`,
      "x-supernode-signature": signNodeHeartbeat(body, nodeSigningSecret)
    },
    body
  });
  if (!response.ok) {
    throw new Error(`heartbeat rejected with ${response.status}`);
  }
  retryCount = 0;
}

async function probeConfiguredPrinter(): Promise<{
  printerStatus: "HEALTHY" | "OFFLINE";
  cameraStatus: "UNKNOWN" | "ONLINE" | "OFFLINE";
}> {
  if (!printerId || (!printerControlUrl && !printerCameraUrl)) {
    return { printerStatus: "OFFLINE", cameraStatus: "UNKNOWN" };
  }

  const [controlReachable, cameraReachable] = await Promise.all([
    printerControlUrl ? probeEndpoint(printerControlUrl, 2500) : Promise.resolve(false),
    printerCameraUrl ? probeEndpoint(printerCameraUrl, 4000) : Promise.resolve(false)
  ]);

  return {
    printerStatus: controlReachable || cameraReachable ? "HEALTHY" : "OFFLINE",
    cameraStatus: printerCameraUrl ? (cameraReachable ? "ONLINE" : "OFFLINE") : "UNKNOWN"
  };
}

function probeEndpoint(url: string, timeoutMs: number) {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return probeWebSocket(url, timeoutMs);
  }
  return probeHttp(url, timeoutMs);
}

async function startCameraFrameBridge() {
  if (!printerId || !printerCameraUrl) {
    cameraBridgeLastError = "SuperNode camera bridge is not configured";
    return;
  }

  for (;;) {
    try {
      if (printerControlUrl?.startsWith("ws")) {
        await enableCentauriVideo(printerControlUrl).catch(() => undefined);
      }
      cameraBridgeLastError = null;
      await streamCameraFrames(printerCameraUrl);
    } catch (error) {
      cameraBridgeLastError = error instanceof Error ? error.message : String(error);
      console.error(`camera bridge: ${cameraBridgeLastError}`);
      await sleep(3000);
    }
  }
}

function getCameraBridgeHeartbeatError() {
  if (!printerCameraUrl) return null;
  if (cameraBridgeLastError) return `SuperNode camera bridge: ${cameraBridgeLastError}`;
  if (mediaPushUrl && mediaRelayLastError) return `SuperNode media relay: ${mediaRelayLastError}`;
  if (!cameraBridgeLastFrameAt) return "SuperNode camera bridge has not uploaded a frame yet";
  const ageMs = Date.now() - cameraBridgeLastFrameAt;
  return ageMs > 30_000 ? `SuperNode camera bridge last uploaded a frame ${Math.round(ageMs / 1000)}s ago` : null;
}

async function startMediaRelayBridge() {
  if (!mediaPushUrl || !mediaSourceUrl) return;

  for (;;) {
    const startedAt = Date.now();
    mediaRelayLastError = null;
    console.log(`media relay: pushing ${mediaSourceUrl} to configured media server`);

    try {
      await runFfmpegRelay();
      mediaRelayLastError = "ffmpeg exited";
    } catch (error) {
      mediaRelayLastError = error instanceof Error ? error.message : String(error);
      console.error(`media relay: ${mediaRelayLastError}`);
    }

    const ranForMs = Date.now() - startedAt;
    await sleep(ranForMs < 10_000 ? 5000 : 1500);
  }
}

function runFfmpegRelay() {
  return new Promise<void>((resolve, reject) => {
    const args = buildFfmpegRelayArgs();
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2000).unref();
    };

    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-2000);
    });
    child.on("error", (error) => {
      cleanupProcessSignals(stop);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      cleanupProcessSignals(stop);
      if (code === 0 || signal === "SIGTERM" || signal === "SIGINT") {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with ${code ?? signal}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

function buildFfmpegRelayArgs() {
  const fps = Number.isFinite(mediaFps) && mediaFps > 0 ? Math.round(mediaFps) : 15;
  const scaleFilter = mediaScale ? `scale=${mediaScale}` : null;
  const filters = [`fps=${fps}`, scaleFilter].filter(Boolean).join(",");
  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-fflags",
    "nobuffer",
    "-flags",
    "low_delay",
    "-probesize",
    "32",
    "-analyzeduration",
    "0",
    "-i",
    mediaSourceUrl ?? "",
    "-an",
    "-vf",
    filters,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-g",
    String(fps * 2),
    "-b:v",
    mediaBitrate,
    "-maxrate",
    mediaBitrate,
    "-bufsize",
    mediaBitrate,
    "-f",
    "flv",
    mediaPushUrl ?? ""
  ];
}

function cleanupProcessSignals(listener: () => void) {
  process.off("SIGTERM", listener);
  process.off("SIGINT", listener);
}

function streamCameraFrames(url: string) {
  return new Promise<void>((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { timeout: 5000 }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        response.resume();
        reject(new Error(`camera stream unavailable with HTTP ${response.statusCode ?? 503}`));
        return;
      }

      const chunks: Buffer[] = [];
      let buffered = Buffer.alloc(0);
      const contentType = response.headers["content-type"] ?? "multipart/x-mixed-replace";

      response.on("data", (chunk: Buffer) => {
        if (String(contentType).toLowerCase().startsWith("image/jpeg")) {
          chunks.push(chunk);
          return;
        }

        buffered = Buffer.concat([buffered, chunk]);
        let frame = extractJpegFrame(buffered);
        while (frame) {
          buffered = buffered.subarray(frame.endOffset);
          void postCameraFrame(frame.jpeg);
          frame = extractJpegFrame(buffered);
        }
        if (buffered.byteLength > 4 * 1024 * 1024) {
          buffered = buffered.subarray(buffered.byteLength - 1024 * 1024);
        }
      });

      response.on("end", () => {
        if (chunks.length) void postCameraFrame(Buffer.concat(chunks));
        resolve();
      });
      response.on("close", resolve);
      response.on("error", reject);
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("camera stream timed out"));
    });
    request.on("error", reject);
  });
}

function extractJpegFrame(buffer: Buffer) {
  const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
  if (start < 0) return null;
  const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
  if (end < 0) return null;
  const endOffset = end + 2;
  return { jpeg: buffer.subarray(start, endOffset), endOffset };
}

async function postCameraFrame(frame: Buffer) {
  const now = Date.now();
  if (!printerId || !nodeSecret || cameraFrameUploadInFlight || now - latestCameraFrameAt < cameraFrameIntervalMs) return;
  latestCameraFrameAt = now;
  cameraFrameUploadInFlight = true;
  const body = frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer;

  try {
    const response = await fetch(`${apiBaseUrl}/api/supernode/camera-frame`, {
      method: "POST",
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer ${nodeSigningSecret}`,
        "x-supernode-id": nodeId,
        "x-supernode-printer-id": printerId
      },
      body
    });
    if (!response.ok) {
      throw new Error(`camera frame upload rejected with ${response.status}`);
    }
    cameraBridgeLastFrameAt = Date.now();
    cameraBridgeLastError = null;
  } finally {
    cameraFrameUploadInFlight = false;
  }
}

function enableCentauriVideo(controlApiUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(controlApiUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Centauri video enable timed out"));
    }, 2500);

    socket.on("open", () => {
      socket.send(JSON.stringify({
        Id: "0000000000000000",
        Data: {
          Cmd: 386,
          Data: { Enable: 1 },
          RequestID: String(Date.now()),
          MainboardID: "0000000000000000",
          TimeStamp: Date.now(),
          From: 1
        },
        Topic: ""
      }));
    });
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as { Data?: { Cmd?: number; Data?: { Ack?: number } } };
        if (message.Data?.Cmd === 386) {
          clearTimeout(timeout);
          socket.close();
          message.Data.Data?.Ack === 0 ? resolve() : reject(new Error("Centauri rejected video enable"));
        }
      } catch {
        // Ignore unrelated non-JSON frames.
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.on("close", () => clearTimeout(timeout));
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeWebSocket(url: string, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      resolve(false);
    }, timeoutMs);

    socket.on("open", () => {
      clearTimeout(timeout);
      socket.close();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function probeHttp(url: string, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { timeout: timeoutMs }, (response) => {
      const reachable = Boolean(response.statusCode && response.statusCode < 400);
      response.destroy();
      resolve(reachable);
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function syncReadyJobs() {
  const response = await fetch(`${apiBaseUrl}/api/supernode/jobs?nodeId=${encodeURIComponent(nodeId)}`, {
    headers: { authorization: `Bearer ${nodeSigningSecret}` }
  });
  if (!response.ok) {
    throw new Error(`job poll rejected with ${response.status}`);
  }
  const { jobs } = (await response.json()) as { jobs: Array<{ id: string; downloadUrl: string }> };
  await mkdir(nodeJobsDir, { recursive: true });

  for (const job of jobs) {
    const download = await fetch(`${apiBaseUrl}${job.downloadUrl}`, {
      headers: { authorization: `Bearer ${nodeSigningSecret}` }
    });
    if (!download.ok) {
      throw new Error(`gcode download rejected with ${download.status}`);
    }
    const localJobPath = path.join(nodeJobsDir, `${job.id}.gcode`);
    await writeFile(localJobPath, Buffer.from(await download.arrayBuffer()));
    const ack = await fetch(`${apiBaseUrl}/api/supernode/jobs/${job.id}/ack`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${nodeSigningSecret}` },
      body: JSON.stringify({ nodeId, localJobPath })
    });
    if (!ack.ok) {
      throw new Error(`job acknowledgement rejected with ${ack.status}`);
    }
  }
}

async function acknowledgeApprovedPrintCommands() {
  const response = await fetch(`${apiBaseUrl}/api/supernode/commands?nodeId=${encodeURIComponent(nodeId)}`, {
    headers: { authorization: `Bearer ${nodeSigningSecret}` }
  });
  if (!response.ok) {
    throw new Error(`command poll rejected with ${response.status}`);
  }
  const { commands } = (await response.json()) as { commands: Array<{ id: string; adapter: string; localJobPath: string | null }> };

  for (const command of commands) {
    if (command.adapter !== "manual-noop") {
      throw new Error(`unsupported printer adapter ${command.adapter}`);
    }
    const ack = await fetch(`${apiBaseUrl}/api/supernode/commands/${command.id}/ack`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${nodeSigningSecret}` },
      body: JSON.stringify({ nodeId })
    });
    if (!ack.ok) {
      throw new Error(`command acknowledgement rejected with ${ack.status}`);
    }
  }
}

async function loop() {
  try {
    await sendHeartbeat();
    await syncReadyJobs();
    await acknowledgeApprovedPrintCommands();
  } catch (error) {
    retryCount += 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    const backoff = Math.min(heartbeatIntervalMs * 4, heartbeatIntervalMs * Math.max(1, retryCount));
    setTimeout(loop, retryCount ? backoff : heartbeatIntervalMs);
  }
}

void startCameraFrameBridge();
void startMediaRelayBridge();
loop();
