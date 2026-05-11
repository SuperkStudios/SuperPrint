import { describe, expect, it } from "vitest";
import { completePrintingJobAccounting, failPrintingJobAccounting } from "./print-completion";

describe("print completion accounting", () => {
  it("records consumed reserved grams and runtime on completion", () => {
    expect(
      completePrintingJobAccounting({
        status: "PRINTING",
        reservedFilamentGrams: 84,
        elapsedSeconds: 7200
      })
    ).toEqual({
      consumedFilamentGrams: 84,
      runtimeMinutes: 120,
      completedPrintIncrement: 1
    });
  });

  it("requires a failure reason and can request requeue", () => {
    expect(() => failPrintingJobAccounting({ status: "PRINTING", reason: "" })).toThrow("Failure reason is required");
    expect(failPrintingJobAccounting({ status: "PRINTING", reason: "Layer shift", requeue: true })).toEqual({
      failureReason: "Layer shift",
      requeue: true,
      failedPrintIncrement: 1
    });
  });
});
