import { describe, expect, it } from "vitest";
import { createMediaToken, readMediaToken } from "./media-token";

describe("media tokens", () => {
  it("round-trips storage keys without exposing raw filesystem paths", () => {
    const token = createMediaToken({ key: "videos/SP-1001.mp4", expiresAt: 2_000_000_000_000 }, "secret");

    expect(token).not.toContain("/data");
    expect(readMediaToken(token, "secret", 1_900_000_000_000)).toEqual({
      key: "videos/SP-1001.mp4",
      expiresAt: 2_000_000_000_000
    });
  });

  it("rejects expired or tampered tokens", () => {
    const token = createMediaToken({ key: "videos/SP-1001.mp4", expiresAt: 2_000_000_000_000 }, "secret");

    expect(() => readMediaToken(token, "secret", 2_100_000_000_000)).toThrow("Media token expired");
    expect(() => readMediaToken(`${token}x`, "secret", 1_900_000_000_000)).toThrow("Invalid media token");
  });
});
