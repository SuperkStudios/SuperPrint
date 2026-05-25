import { describe, expect, it } from "vitest";
import { hasUsableSlicerEstimate, planProductionPlateOrder } from "./production-loop";

describe("planProductionPlateOrder", () => {
  it("prints the largest color group first and keeps all plates for that color together", () => {
    const plan = planProductionPlateOrder({
      plates: [
        { id: "red-1", filamentId: "red", material: "PLA", color: "Red", quantityPlanned: 4, createdAt: new Date("2026-01-01") },
        { id: "blue-1", filamentId: "blue", material: "PLA", color: "Blue", quantityPlanned: 2, createdAt: new Date("2026-01-02") },
        { id: "red-2", filamentId: "red", material: "PLA", color: "Red", quantityPlanned: 4, createdAt: new Date("2026-01-03") }
      ]
    });

    expect(plan.orderedPlateIds).toEqual(["red-1", "red-2", "blue-1"]);
    expect(plan.groups[0]).toMatchObject({ filamentId: "red", totalQuantity: 8, plateCount: 2 });
  });

  it("uses the loaded filament before higher demand when a spool is already loaded", () => {
    const tied = planProductionPlateOrder({
      currentFilamentId: "blue",
      plates: [
        { id: "red-1", filamentId: "red", material: "PLA", color: "Red", quantityPlanned: 4, createdAt: new Date("2026-01-01") },
        { id: "blue-1", filamentId: "blue", material: "PLA", color: "Blue", quantityPlanned: 4, createdAt: new Date("2026-01-02") }
      ]
    });
    expect(tied.orderedPlateIds).toEqual(["blue-1", "red-1"]);

    const higherDemand = planProductionPlateOrder({
      currentFilamentId: "blue",
      plates: [
        { id: "red-1", filamentId: "red", material: "PLA", color: "Red", quantityPlanned: 5, createdAt: new Date("2026-01-01") },
        { id: "blue-1", filamentId: "blue", material: "PLA", color: "Blue", quantityPlanned: 4, createdAt: new Date("2026-01-02") }
      ]
    });
    expect(higherDemand.orderedPlateIds).toEqual(["blue-1", "red-1"]);
  });
});

describe("hasUsableSlicerEstimate", () => {
  it("requires G-code, minutes, and grams", () => {
    expect(hasUsableSlicerEstimate({ outputStorageKey: "sliced/a.gcode", estimatedPrintMinutes: 42, estimatedGrams: 12 })).toBe(true);
    expect(hasUsableSlicerEstimate({ outputStorageKey: "uploads/a.3mf", estimatedPrintMinutes: 42, estimatedGrams: 12 })).toBe(false);
    expect(hasUsableSlicerEstimate({ outputStorageKey: "sliced/a.gcode", estimatedPrintMinutes: 42, estimatedGrams: null })).toBe(false);
    expect(hasUsableSlicerEstimate({ outputStorageKey: null, estimatedPrintMinutes: 42, estimatedGrams: 12 })).toBe(false);
  });
});
