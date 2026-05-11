import { describe, expect, it } from "vitest";
import { assignQueuedJobToPrinter } from "./queue-preparation";

const queuedJob = {
  id: "job_1",
  status: "QUEUED" as const,
  filament: { material: "PLA" }
};

describe("queue preparation", () => {
  it("assigns a queued job to an online compatible printer with no open maintenance", () => {
    expect(
      assignQueuedJobToPrinter(queuedJob, [
        {
          id: "printer_1",
          heartbeatStatus: "ONLINE",
          status: "HEALTHY",
          supportedMaterials: ["PLA", "PETG"],
          currentFilament: { material: "PLA", remainingGrams: 700, thresholdGrams: 100 },
          openMaintenanceTasks: 0
        }
      ])
    ).toMatchObject({
      printerId: "printer_1",
      blockedReason: null
    });
  });

  it("blocks assignment when printers are offline, under maintenance, or filament-incompatible", () => {
    expect(
      assignQueuedJobToPrinter(queuedJob, [
        {
          id: "printer_1",
          heartbeatStatus: "OFFLINE",
          status: "OFFLINE",
          supportedMaterials: ["PLA"],
          currentFilament: { material: "PLA", remainingGrams: 700, thresholdGrams: 100 },
          openMaintenanceTasks: 0
        },
        {
          id: "printer_2",
          heartbeatStatus: "ONLINE",
          status: "MAINTENANCE",
          supportedMaterials: ["PLA"],
          currentFilament: { material: "PLA", remainingGrams: 700, thresholdGrams: 100 },
          openMaintenanceTasks: 1
        },
        {
          id: "printer_3",
          heartbeatStatus: "ONLINE",
          status: "HEALTHY",
          supportedMaterials: ["PETG"],
          currentFilament: { material: "PETG", remainingGrams: 700, thresholdGrams: 100 },
          openMaintenanceTasks: 0
        }
      ])
    ).toEqual({
      printerId: null,
      blockedReason: "No eligible online printer with compatible filament and clear maintenance"
    });
  });
});
