import { describe, expect, it } from "vitest";
import {
  markPrintCompleted,
  markPrintFailed,
  markPrintPaused,
  markPrintRequeued,
  markPrintStarted,
  publicQueueJob,
  reorderQueue
} from "./queue";

const jobs = [
  { id: "job_1", status: "QUEUED" as const, queuePosition: 1 },
  { id: "job_2", status: "QUEUED" as const, queuePosition: 2 },
  { id: "job_3", status: "QUEUED" as const, queuePosition: 3 }
];

describe("queue transitions", () => {
  it("reorders queued jobs into contiguous positions", () => {
    expect(reorderQueue(jobs, ["job_3", "job_1", "job_2"])).toEqual([
      { id: "job_3", status: "QUEUED", queuePosition: 1 },
      { id: "job_1", status: "QUEUED", queuePosition: 2 },
      { id: "job_2", status: "QUEUED", queuePosition: 3 }
    ]);
  });

  it("moves operator-approved jobs through started, completed, and failed states", () => {
    const approved = { ...jobs[0], status: "AWAITING_OPERATOR_START" as const };
    const started = markPrintStarted(approved, new Date("2026-05-01T10:00:00.000Z"));
    expect(started).toMatchObject({
      id: "job_1",
      status: "PRINTING",
      startedAt: new Date("2026-05-01T10:00:00.000Z")
    });

    expect(markPrintCompleted(started, new Date("2026-05-01T12:00:00.000Z"))).toMatchObject({
      id: "job_1",
      status: "COMPLETED",
      completedAt: new Date("2026-05-01T12:00:00.000Z")
    });

    expect(markPrintFailed(started, "nozzle jam", new Date("2026-05-01T10:30:00.000Z"))).toMatchObject({
      id: "job_1",
      status: "FAILED",
      failureReason: "nozzle jam",
      completedAt: new Date("2026-05-01T10:30:00.000Z")
    });
  });

  it("pauses and requeues printing or failed jobs with guardrails", () => {
    const started = markPrintStarted({ ...jobs[0], status: "AWAITING_OPERATOR_START" as const }, new Date("2026-05-01T10:00:00.000Z"));
    const paused = markPrintPaused(started, new Date("2026-05-01T10:15:00.000Z"));

    expect(paused).toMatchObject({ id: "job_1", status: "PAUSED" });
    expect(markPrintRequeued(paused, 4)).toMatchObject({
      id: "job_1",
      status: "QUEUED",
      queuePosition: 4,
      failureReason: null
    });
    expect(() => markPrintPaused(jobs[0])).toThrow("Only printing jobs can be paused");
    expect(() => markPrintRequeued({ ...jobs[0], status: "COMPLETED" as const }, 4)).toThrow(
      "Only paused or failed jobs can be requeued"
    );
  });

  it("sanitizes public queue jobs without internal printer data or filesystem paths", () => {
    expect(
      publicQueueJob({
        id: "job_1",
        status: "PRINTING",
        queuePosition: 0,
        etaMinutes: 10,
        streamUrl: "https://example.com/live",
        order: { orderNumber: "SP-1001" },
        printer: {
          publicName: "Forge One",
          status: "HEALTHY",
          healthDescription: "Nominal",
          internalIp: "10.0.0.4",
          controlApiUrl: "http://10.0.0.4/api"
        },
        filament: { material: "PLA", color: "Black", remainingGrams: 500, thresholdGrams: 100 }
      })
    ).toEqual({
      id: "job_1",
      orderNumber: "SP-1001",
      status: "PRINTING",
      queuePosition: 0,
      etaMinutes: 10,
      progressPercent: 8,
      streamUrl: "https://example.com/live",
      printer: { name: "Forge One", status: "HEALTHY", healthDescription: "Nominal" },
      filament: { material: "PLA", color: "Black", remainingGrams: 500, low: false }
    });
  });

  it("rejects invalid state transitions", () => {
    expect(() => markPrintStarted({ ...jobs[0], status: "COMPLETED" as const })).toThrow(
      "Only operator-approved jobs can be started"
    );
    expect(() => markPrintCompleted(jobs[0])).toThrow("Only printing jobs can be completed");
    expect(() => markPrintFailed(jobs[0], "nozzle jam")).toThrow("Only printing jobs can fail");
    expect(() => reorderQueue(jobs, ["job_1", "job_1", "job_3"])).toThrow(
      "Queue order must contain each queued job exactly once"
    );
  });
});
