import { mkdir, writeFile } from "node:fs/promises";
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
const nodeJobsDir = process.env.SUPERNODE_JOBS_PATH ?? "/data/node-jobs";

if (!nodeSecret) {
  throw new Error("SUPERNODE_SECRET is required after registration");
}
const nodeSigningSecret = nodeSecret;

let retryCount = 0;

async function sendHeartbeat() {
  const printerHealth = await probeConfiguredPrinter();
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
    retryCount
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

loop();
