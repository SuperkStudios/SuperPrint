import { describe, expect, it } from "vitest";
import { buildOrcaSlicerCommand, resolveSlicedFileLifecycle } from "./orca-slicer";

describe("OrcaSlicer seam", () => {
  it("builds a CLI command without shell interpolation", () => {
    expect(
      buildOrcaSlicerCommand({
        executablePath: "/usr/local/bin/orca-slicer",
        inputPath: "/data/uploads/model.stl",
        outputPath: "/data/sliced/model.gcode",
        machineProfilePath: "/data/profiles/centauri.json",
        filamentProfilePath: "/data/profiles/pla.json",
        slicerProfilePath: "/data/profiles/standard.json"
      })
    ).toEqual({
      command: "/usr/local/bin/orca-slicer",
      args: [
        "--slice",
        "--load-settings",
        "/data/profiles/standard.json",
        "--load-machine",
        "/data/profiles/centauri.json",
        "--load-filament",
        "/data/profiles/pla.json",
        "--output",
        "/data/sliced/model.gcode",
        "/data/uploads/model.stl"
      ]
    });
  });

  it("tracks sliced file lifecycle from requested to ready or failed", () => {
    expect(resolveSlicedFileLifecycle("PENDING", "start")).toBe("RUNNING");
    expect(resolveSlicedFileLifecycle("RUNNING", "complete")).toBe("READY");
    expect(resolveSlicedFileLifecycle("RUNNING", "fail")).toBe("FAILED");
    expect(() => resolveSlicedFileLifecycle("READY", "start")).toThrow("Slice job transition is invalid");
  });
});
