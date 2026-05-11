import { signNodeHeartbeat } from "../../src/domain/supernode-auth";

const apiBaseUrl = process.env.SUPERPRINT_API_URL ?? "http://app:3000";
const nodeId = process.env.SUPERNODE_ID ?? "supernode-local";
const nodeSecret = process.env.SUPERNODE_SECRET;
const printerId = process.env.SUPERNODE_PRINTER_ID;
const heartbeatIntervalMs = Number(process.env.SUPERNODE_HEARTBEAT_INTERVAL_MS ?? 15000);

if (!nodeSecret) {
  throw new Error("SUPERNODE_SECRET is required after registration");
}

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
      authorization: `Bearer ${nodeSecret}`,
      "x-supernode-signature": signNodeHeartbeat(body, nodeSecret)
    },
    body
  });
  if (!response.ok) {
    throw new Error(`heartbeat rejected with ${response.status}`);
  }
  retryCount = 0;
}

async function loop() {
  try {
    await sendHeartbeat();
  } catch (error) {
    retryCount += 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    const backoff = Math.min(heartbeatIntervalMs * 4, heartbeatIntervalMs * Math.max(1, retryCount));
    setTimeout(loop, retryCount ? backoff : heartbeatIntervalMs);
  }
}

loop();
