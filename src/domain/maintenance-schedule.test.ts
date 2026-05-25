import { describe, expect, it } from "vitest";
import { planMaintenanceTasks } from "./maintenance-schedule";

describe("maintenance schedule planning", () => {
  it("creates due maintenance tasks from runtime and recent failures", () => {
    const due = planMaintenanceTasks({
      printerId: "printer_1",
      now: new Date("2026-05-14T10:00:00Z"),
      totalRuntimeMinutes: 125 * 60,
      failedPrintCount: 3,
      existingOpenTaskTitles: ["Clean build plate and verify camera view"]
    });

    expect(due.map((task) => task.title)).toEqual([
      "ELEGOO 90-day motion lubrication",
      "Inspect nozzle, hotend, belts, fans, and filament path",
      "Clean and lubricate approved motion components",
      "Failure recovery inspection"
    ]);
    expect(due[0].description).toContain("ELEGOO Centauri Carbon");
    expect(due[2].description).toContain("manufacturer-approved grease");
    expect(due[3].description).toContain("spaghetti");
  });

  it("does not ask for ELEGOO motion lubrication again inside the 90-day window", () => {
    const due = planMaintenanceTasks({
      printerId: "printer_1",
      now: new Date("2026-05-14T10:00:00Z"),
      totalRuntimeMinutes: 10 * 60,
      failedPrintCount: 0,
      completedTasks: [{ title: "ELEGOO 90-day motion lubrication", completedAt: new Date("2026-04-14T10:00:00Z") }]
    });

    expect(due.map((task) => task.title)).not.toContain("ELEGOO 90-day motion lubrication");
  });
});
