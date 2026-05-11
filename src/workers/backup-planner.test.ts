import { describe, expect, it } from "vitest";
import { createBackupPlan } from "./backup-planner";

describe("createBackupPlan", () => {
  it("plans database dump, media archive, encrypted bundle, upload, and restore metadata", () => {
    const plan = createBackupPlan({
      runId: "20260511T213000Z",
      dataRoot: "/data",
      databaseUrl: "postgresql://postgres:postgres@postgres:5432/superprint",
      socialBladeBucket: "social-blade://superprint-backups",
      encryptionPassphrase: "secret"
    });

    expect(plan.bundlePath).toBe("/data/backup-staging/superprint-20260511T213000Z.tar.gz.enc");
    expect(plan.steps.map((step) => step.kind)).toEqual([
      "postgres-dump",
      "media-archive",
      "encrypt-bundle",
      "upload-social-blade",
      "write-manifest"
    ]);
    expect(plan.mediaSources).toEqual([
      "/data/uploads",
      "/data/sliced",
      "/data/videos",
      "/data/timelapses",
      "/data/thumbnails",
      "/data/logs"
    ]);
  });
});
