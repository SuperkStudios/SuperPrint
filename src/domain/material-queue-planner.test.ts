import { describe, expect, it } from "vitest";
import { planMaterialAwareQueue } from "./material-queue-planner";

describe("material-aware queue planner", () => {
  it("runs compatible jobs before requesting a filament change", () => {
    const plan = planMaterialAwareQueue({
      currentMaterial: "PLA",
      jobs: [
        { id: "petg_1", queuePosition: 1, material: "PETG" },
        { id: "pla_1", queuePosition: 2, material: "PLA" },
        { id: "pla_2", queuePosition: 3, material: "PLA" }
      ]
    });

    expect(plan.orderedJobIds).toEqual(["pla_1", "pla_2", "petg_1"]);
    expect(plan.requiredFilamentChange).toBeNull();
  });

  it("requests a filament change when the only ready work needs another material", () => {
    const plan = planMaterialAwareQueue({
      currentMaterial: "PLA",
      jobs: [{ id: "petg_1", queuePosition: 1, material: "PETG" }]
    });

    expect(plan.orderedJobIds).toEqual(["petg_1"]);
    expect(plan.requiredFilamentChange).toEqual({
      fromMaterial: "PLA",
      toMaterial: "PETG",
      reason: "Next queued job requires PETG, but PLA is loaded"
    });
  });
});
