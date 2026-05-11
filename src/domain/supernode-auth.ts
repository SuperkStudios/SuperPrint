import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const heartbeatWindowMs = 5 * 60 * 1000;

export function createNodeSecret(nodeId: string) {
  return `${nodeId}.${randomBytes(32).toString("base64url")}`;
}

export async function hashNodeSecret(secret: string) {
  return bcrypt.hash(secret, 12);
}

export async function compareNodeSecret(secret: string, hash: string) {
  return bcrypt.compare(secret, hash);
}

export function signNodeHeartbeat(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyNodeHeartbeat(payload: string, signature: string, secret: string, now = new Date()) {
  const expected = signNodeHeartbeat(payload, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return false;
  }

  const parsed = JSON.parse(payload) as { timestamp?: string };
  const timestamp = parsed.timestamp ? new Date(parsed.timestamp).getTime() : Number.NaN;
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return Math.abs(now.getTime() - timestamp) <= heartbeatWindowMs;
}
