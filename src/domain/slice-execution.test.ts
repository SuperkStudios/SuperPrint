import { describe, expect, it } from "vitest";
import { resolveSliceExecution } from "./slice-execution";

describe("slice execution results", () => {
  it("blocks slicing when the CLI is unavailable", () => {
    expect(resolveSliceExecution({ cliAvailable: false })).toEqual({
      status: "BLOCKED",
      blockedReason: "OrcaSlicer CLI is unavailable or not executable"
    });
  });

  it("marks slicing failed when the CLI exits non-zero", () => {
    expect(resolveSliceExecution({ cliAvailable: true, exitCode: 2, stdout: "", stderr: "bad mesh" })).toEqual({
      status: "FAILED",
      errorLog: "bad mesh",
      stdoutLog: "",
      stderrLog: "bad mesh"
    });
  });

  it("persists successful output and conservative estimates from review fields", () => {
    expect(
      resolveSliceExecution({
        cliAvailable: true,
        exitCode: 0,
        stdout: "warning: thin wall\nestimated printing time: 2h 10m\nfilament used [g]: 81.4",
        stderr: "",
        outputStorageKey: "sliced/model.gcode",
        reviewEstimatedMinutes: 180,
        reviewEstimatedGrams: 84
      })
    ).toEqual({
      status: "READY",
      outputStorageKey: "sliced/model.gcode",
      estimatedPrintMinutes: 130,
      estimatedGrams: 81,
      warnings: ["warning: thin wall"],
      stdoutLog: "warning: thin wall\nestimated printing time: 2h 10m\nfilament used [g]: 81.4",
      stderrLog: ""
    });
  });
});
