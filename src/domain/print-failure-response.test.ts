import { describe, expect, it } from "vitest";
import { planPrintAnomalyResponse } from "./print-failure-response";

describe("print anomaly response", () => {
  it("stops high-confidence spaghetti prints and creates recovery work", () => {
    expect(
      planPrintAnomalyResponse({
        type: "SPAGHETTI",
        confidence: 0.91,
        printJobId: "job_1",
        printerId: "printer_1"
      })
    ).toEqual({
      severity: "critical",
      printerAction: "stop",
      markJobFailed: true,
      printerStatus: "MAINTENANCE",
      notificationTitle: "Spaghetti print detected",
      maintenanceTask: {
        printerId: "printer_1",
        title: "Check bed and recover failed print",
        description: expect.stringContaining("Clear spaghetti")
      }
    });
  });

  it("notifies but does not stop on low-confidence detections", () => {
    expect(
      planPrintAnomalyResponse({
        type: "SPAGHETTI",
        confidence: 0.42,
        printJobId: "job_1",
        printerId: "printer_1"
      })
    ).toMatchObject({
      severity: "watch",
      printerAction: "notify",
      markJobFailed: false
    });
  });
});
