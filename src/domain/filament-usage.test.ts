import { describe, expect, it } from "vitest";
import { calculateFilamentRollUsage, filterCompletedPrinterHistory, planCompletedPrintAssignments, planFilamentStockAssignments } from "./filament-usage";
import { buildCentauriHistoryDetailRequest, extractCentauriTasks, extractCompletedCentauriHistory, parseGcodeFilamentGrams } from "./centauri-history";

describe("filament roll usage", () => {
  it("calculates remaining grams and material costs from assigned completed prints", () => {
    const result = calculateFilamentRollUsage({
      startingGrams: 1000,
      rollCostCents: 2499,
      assignedPrints: [
        { id: "task-1", name: "bracket.gcode", gramsUsed: 42 },
        { id: "task-2", name: "tray.gcode", gramsUsed: 108 }
      ]
    });

    expect(result).toEqual({
      assignedGrams: 150,
      remainingGrams: 850,
      costPerGramCents: 2.499,
      assignedPrintCosts: [
        { id: "task-1", materialCostCents: 105 },
        { id: "task-2", materialCostCents: 270 }
      ]
    });
  });

  it("never reports negative remaining grams", () => {
    expect(
      calculateFilamentRollUsage({
        startingGrams: 1000,
        rollCostCents: 2000,
        assignedPrints: [{ id: "too-big", name: "huge.gcode", gramsUsed: 1200 }]
      }).remainingGrams
    ).toBe(0);
  });

  it("uses a fixed 1kg roll and ignores selected completed prints", () => {
    const plan = planCompletedPrintAssignments({
      rollCostCents: 2200,
      completedPrints: [
        { id: "real-job", name: "customer.gcode", status: "COMPLETED", gramsUsed: 44 },
        { id: "test-job", name: "sample pla plus.gcode", status: "COMPLETED", gramsUsed: 30 }
      ],
      assignedIds: ["real-job"],
      ignoredIds: ["test-job"]
    });

    expect(plan.assignedPrints).toEqual([{ id: "real-job", name: "customer.gcode", gramsUsed: 44 }]);
    expect(plan.ignoredPrints).toEqual([{ id: "test-job", name: "sample pla plus.gcode", gramsUsed: 30 }]);
    expect(plan.usage.remainingGrams).toBe(956);
  });

  it("assigns completed prints to separate 1kg stock rolls", () => {
    const stock = planFilamentStockAssignments({
      spools: [
        { localId: "spool-red", material: "PLA", color: "Red", brand: "Bambu", rollCostCents: 2400 },
        { localId: "spool-black", material: "PETG", color: "Black", brand: "Polymaker", rollCostCents: 3000 }
      ],
      completedPrints: [
        { id: "dragon", name: "dragon.gcode", status: "COMPLETED", gramsUsed: 120 },
        { id: "fixture", name: "fixture.gcode", status: "COMPLETED", gramsUsed: 80 },
        { id: "test", name: "test.gcode", status: "COMPLETED", gramsUsed: 40 }
      ],
      assignments: { dragon: "spool-red", fixture: "spool-black" },
      ignoredIds: ["test"]
    });

    expect(stock.spools.map((spool) => ({ localId: spool.localId, remainingGrams: spool.usage.remainingGrams }))).toEqual([
      { localId: "spool-red", remainingGrams: 880 },
      { localId: "spool-black", remainingGrams: 920 }
    ]);
    expect(stock.ignoredPrints).toEqual([{ id: "test", name: "test.gcode", gramsUsed: 40 }]);
  });
});

describe("Centauri history parsing", () => {
  it("builds task detail requests with the Centauri batch Id array shape", () => {
    const request = buildCentauriHistoryDetailRequest("mainboard-1", ["task-1", "task-2"]);

    expect(request.Data.Cmd).toBe(321);
    expect(request.Data.Data).toEqual({ Id: ["task-1", "task-2"] });
  });

  it("extracts completed SDCP history tasks with grams used", () => {
    const result = extractCompletedCentauriHistory([
      {
        Id: "task-a",
        TaskName: "dragon.gcode",
        Status: 1,
        FilamentUsed: 123.4,
        EndTime: 1778547600
      },
      {
        Id: "task-b",
        TaskName: "active.gcode",
        Status: 0,
        FilamentUsed: 20
      }
    ]);

    expect(result).toEqual([
      {
        id: "task-a",
        name: "dragon.gcode",
        status: "COMPLETED",
        gramsUsed: 123.4,
        completedAt: new Date(1778547600 * 1000).toISOString()
      }
    ]);
  });

  it("accepts Centauri completed status strings and alternate material fields", () => {
    const result = extractCompletedCentauriHistory([
      {
        TaskID: "task-c",
        FileName: "fixture.gcode",
        TaskStatus: "Completed",
        TotalFilamentWeight: "37.5"
      }
    ]);

    expect(result).toEqual([
      {
        id: "task-c",
        name: "fixture.gcode",
        status: "COMPLETED",
        gramsUsed: 37.5,
        completedAt: undefined
      }
    ]);
  });

  it("extracts nested Centauri history detail rows once", () => {
    const result = extractCentauriTasks([
      {
        Data: {
          Data: {
            HistoryDetailList: [
              {
                TaskId: "task-d",
                TaskName: "/local/dragon.gcode",
                TaskStatus: 1
              }
            ]
          }
        }
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ TaskId: "task-d", TaskName: "/local/dragon.gcode" });
  });

  it("parses OrcaSlicer filament grams from completed gcode", () => {
    expect(parseGcodeFilamentGrams("; filament used [g] = 5.69\n; total filament used [g] = 5.69")).toBe(5.69);
  });
});

describe("printer history filtering", () => {
  it("keeps only completed prints with usable gram estimates", () => {
    const result = filterCompletedPrinterHistory([
      { id: "done", name: "finished.gcode", status: "COMPLETED", gramsUsed: 24, completedAt: "2026-05-12T01:00:00Z" },
      { id: "printing", name: "active.gcode", status: "PRINTING", gramsUsed: 20 },
      { id: "missing-grams", name: "old.gcode", status: "COMPLETED" }
    ]);

    expect(result).toEqual([{ id: "done", name: "finished.gcode", status: "COMPLETED", gramsUsed: 24, completedAt: "2026-05-12T01:00:00Z" }]);
  });
});
