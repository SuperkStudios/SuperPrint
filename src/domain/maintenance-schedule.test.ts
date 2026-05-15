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
      "Inspect nozzle, hotend, belts, fans, and filament path",
      "Clean and lubricate approved motion components",
      "Failure recovery inspection"
    ]);
    expect(due[1].description).toContain("manufacturer-approved grease");
    expect(due[2].description).toContain("spaghetti");
  });
});
