import { describe, expect, it } from "vitest";
import { buildLocalStorageKey, resolveLocalStoragePath } from "./storage";

describe("local Docker volume storage", () => {
  it("normalizes model upload keys into the uploads volume", () => {
    expect(buildLocalStorageKey("uploads", "../bracket final.stl", 1715443200000)).toBe(
      "uploads/1715443200000-bracket-final.stl"
    );
  });

  it("resolves known media classes under the mounted data root", () => {
    expect(resolveLocalStoragePath("videos/SP-1001.mp4", "/data")).toBe("/data/videos/SP-1001.mp4");
    expect(resolveLocalStoragePath("backup-staging/nightly.tar.gz.enc", "/data")).toBe(
      "/data/backup-staging/nightly.tar.gz.enc"
    );
  });

  it("rejects traversal and unknown storage classes", () => {
    expect(() => resolveLocalStoragePath("uploads/../secret.stl", "/data")).toThrow("Invalid storage key");
    expect(() => resolveLocalStoragePath("private/file.txt", "/data")).toThrow("Unknown storage class");
  });
});
