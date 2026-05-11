import { describe, expect, it } from "vitest";
import { ManualNoopPrinterControlAdapter } from "./printer-control";

describe("printer control adapter", () => {
  it("acknowledges start commands without calling real printer APIs", async () => {
    const adapter = new ManualNoopPrinterControlAdapter();

    await expect(
      adapter.startPrint({
        printJobId: "job_1",
        gcodeLocalPath: "/data/node-jobs/job_1.gcode"
      })
    ).resolves.toEqual({
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged start command; no printer API was called."
    });
  });
});
