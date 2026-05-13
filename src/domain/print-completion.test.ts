import { describe, expect, it } from "vitest";
import { completePrintingJobAccounting, failPrintingJobAccounting, stopPrintingJobAccounting } from "./print-completion";

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

  it("accounts for reserved grams when a print truly fails", () => {
    expect(() => failPrintingJobAccounting({ status: "PRINTING", reason: "" })).toThrow("Failure reason is required");
    expect(failPrintingJobAccounting({ status: "PRINTING", reason: "Layer shift", requeue: true, reservedFilamentGrams: 36, elapsedSeconds: 1860 })).toEqual({
      consumedFilamentGrams: 36,
      failureReason: "Layer shift",
      runtimeMinutes: 31,
      requeue: true,
      failedPrintIncrement: 1
    });
  });

  it("accounts for stopped prints without treating them as failed", () => {
    expect(stopPrintingJobAccounting({ status: "PRINTING", reservedFilamentGrams: 12, elapsedSeconds: 600 })).toEqual({
      consumedFilamentGrams: 12,
      runtimeMinutes: 10,
      stoppedPrintIncrement: 1
    });
  });
});
