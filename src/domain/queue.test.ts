import { describe, expect, it } from "vitest";
import {
  markPrintCompleted,
  markPrintFailed,
  markPrintStarted,
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

  it("moves queued jobs through started, completed, and failed states", () => {
    const started = markPrintStarted(jobs[0], new Date("2026-05-01T10:00:00.000Z"));
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

  it("rejects invalid state transitions", () => {
    expect(() => markPrintStarted({ ...jobs[0], status: "COMPLETED" as const })).toThrow(
      "Only queued jobs can be started"
    );
    expect(() => markPrintCompleted(jobs[0])).toThrow("Only printing jobs can be completed");
    expect(() => reorderQueue(jobs, ["job_1", "job_1", "job_3"])).toThrow(
      "Queue order must contain each queued job exactly once"
    );
  });
});
