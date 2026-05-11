import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { signNodeHeartbeat } from "../../src/domain/supernode-auth";

const apiBaseUrl = process.env.SUPERPRINT_API_URL ?? "http://app:3000";
const nodeId = process.env.SUPERNODE_ID ?? "supernode-local";
const nodeSecret = process.env.SUPERNODE_SECRET;
const printerId = process.env.SUPERNODE_PRINTER_ID;
const heartbeatIntervalMs = Number(process.env.SUPERNODE_HEARTBEAT_INTERVAL_MS ?? 15000);
const nodeJobsDir = process.env.SUPERNODE_JOBS_PATH ?? "/data/node-jobs";

if (!nodeSecret) {
  throw new Error("SUPERNODE_SECRET is required after registration");
}
const nodeSigningSecret = nodeSecret;

let retryCount = 0;

async function sendHeartbeat() {
  const payload = {
    nodeId,
    printerId,
    timestamp: new Date().toISOString(),
    heartbeatStatus: "ONLINE",
    printerStatus: "OFFLINE",
    cameraStatus: "UNKNOWN",
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

async function loop() {
  try {
    await sendHeartbeat();
    await syncReadyJobs();
  } catch (error) {
    retryCount += 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    const backoff = Math.min(heartbeatIntervalMs * 4, heartbeatIntervalMs * Math.max(1, retryCount));
    setTimeout(loop, retryCount ? backoff : heartbeatIntervalMs);
  }
}

loop();
