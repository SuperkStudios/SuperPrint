import { describe, expect, it } from "vitest";
import { evaluateQueueAdmission } from "./queue-admission";

const readySlice = {
  status: "READY",
  estimatedGrams: 84,
  estimatedPrintMinutes: 180,
  material: "PLA"
};

const eligiblePrinter = {
  id: "printer_1",
  heartbeatStatus: "ONLINE",
  status: "HEALTHY",
  supportedMaterials: ["PLA", "PETG"],
  openMaintenanceTasks: 0,
  currentFilament: { id: "spool_1", material: "PLA", remainingGrams: 500, thresholdGrams: 100 }
};

describe("queue admission", () => {
  it("admits a ready slice and reserves filament", () => {
    expect(evaluateQueueAdmission(readySlice, eligiblePrinter)).toEqual({
      admitted: true,
      printerId: "printer_1",
      filamentId: "spool_1",
      reservedGrams: 84,
      etaMinutes: 180
    });
  });

  it("blocks admission for non-ready slices", () => {
    expect(evaluateQueueAdmission({ ...readySlice, status: "BLOCKED" }, eligiblePrinter)).toEqual({
      admitted: false,
      blockedReason: "Only ready slice jobs can be admitted to queue"
    });
  });

  it("blocks admission when printer/material/maintenance/filament checks fail", () => {
    expect(evaluateQueueAdmission(readySlice, { ...eligiblePrinter, heartbeatStatus: "OFFLINE" })).toMatchObject({
      admitted: false,
      blockedReason: "Printer is not online"
    });
    expect(evaluateQueueAdmission(readySlice, { ...eligiblePrinter, openMaintenanceTasks: 1 })).toMatchObject({
      admitted: false,
      blockedReason: "Printer has open maintenance"
    });
    expect(evaluateQueueAdmission(readySlice, { ...eligiblePrinter, currentFilament: { ...eligiblePrinter.currentFilament, material: "PETG" } })).toMatchObject({
      admitted: false,
      blockedReason: "Active filament is not compatible"
    });
    expect(evaluateQueueAdmission(readySlice, { ...eligiblePrinter, currentFilament: { ...eligiblePrinter.currentFilament, remainingGrams: 80 } })).toMatchObject({
      admitted: false,
      blockedReason: "Insufficient filament remaining"
    });
  });
});
