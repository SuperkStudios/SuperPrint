import { describe, expect, it } from "vitest";
import {
  createNodeSecret,
  hashNodeSecret,
  signNodeHeartbeat,
  verifyNodeHeartbeat
} from "./supernode-auth";

describe("SuperNode auth", () => {
  it("hashes node secrets without storing the original secret", async () => {
    const secret = createNodeSecret("node_123");
    const hash = await hashNodeSecret(secret);

    expect(secret).toContain("node_123.");
    expect(hash).not.toContain(secret);
    expect(hash.length).toBeGreaterThan(40);
  });

  it("verifies signed heartbeat payloads and rejects tampering", () => {
    const now = "2026-05-11T22:00:00.000Z";
    const payload = JSON.stringify({ nodeId: "node_123", printerId: "printer_1", timestamp: now, status: "ONLINE" });
    const signature = signNodeHeartbeat(payload, "shared-secret");

    expect(verifyNodeHeartbeat(payload, signature, "shared-secret", new Date(now))).toBe(true);
    expect(verifyNodeHeartbeat(payload.replace("ONLINE", "OFFLINE"), signature, "shared-secret", new Date(now))).toBe(false);
  });
});
