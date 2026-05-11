import { describe, expect, it } from "vitest";
import { publicPrintTelemetry } from "./telemetry";

describe("print telemetry", () => {
  it("returns waiting state when telemetry has not arrived", () => {
    expect(publicPrintTelemetry({})).toEqual({
      state: "WAITING_FOR_TELEMETRY"
    });
  });

  it("sanitizes live telemetry for public queue surfaces", () => {
    expect(
      publicPrintTelemetry({
        currentLayer: 12,
        progressPercent: 33,
        elapsedSeconds: 900,
        remainingSeconds: 1800,
        nozzleTempC: 215,
        bedTempC: 60,
        telemetryUpdatedAt: new Date("2026-05-12T00:00:00.000Z"),
        internalNodeId: "node_1",
        nodeLocalJobPath: "/data/node-jobs/job.gcode"
      })
    ).toEqual({
      state: "LIVE",
      currentLayer: 12,
      progressPercent: 33,
      elapsedSeconds: 900,
      remainingSeconds: 1800,
      nozzleTempC: 215,
      bedTempC: 60,
      telemetryUpdatedAt: "2026-05-12T00:00:00.000Z"
    });
  });
});
