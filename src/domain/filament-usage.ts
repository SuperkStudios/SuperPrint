export type CompletedPrinterHistoryItem = {
  id: string;
  name: string;
  status: string;
  gramsUsed?: number;
  gramsSource?: "PRINTER_HISTORY" | "GCODE" | "VOLUME_ESTIMATE" | "MATCHED_COMPLETED_PRINT" | "TIME_ESTIMATE" | "LAYER_ESTIMATE";
  completedAt?: string;
  printTimeSeconds?: number;
  printedLayers?: number;
  totalLayers?: number;
  material?: string;
};

export type AssignedFilamentPrint = {
  id: string;
  name: string;
  gramsUsed: number;
  completedAt?: string;
};

export type FilamentStockRoll = {
  localId: string;
  material: string;
  color: string;
  brand: string;
  rollCostCents?: number;
};

export const DEFAULT_FILAMENT_ROLL_GRAMS = 1000;

export function calculateFilamentRollUsage(input: {
  startingGrams: number;
  rollCostCents: number;
  assignedPrints: AssignedFilamentPrint[];
}) {
  const assignedGrams = input.assignedPrints.reduce((total, print) => total + print.gramsUsed, 0);
  const remainingGrams = Math.max(0, input.startingGrams - assignedGrams);
  const costPerGramCents = input.startingGrams > 0 ? input.rollCostCents / input.startingGrams : 0;

  return {
    assignedGrams,
    remainingGrams,
    costPerGramCents,
    assignedPrintCosts: input.assignedPrints.map((print) => ({
      id: print.id,
      materialCostCents: Math.round(print.gramsUsed * costPerGramCents)
    }))
  };
}

export function filterCompletedPrinterHistory(items: CompletedPrinterHistoryItem[]) {
  return items.filter((item): item is CompletedPrinterHistoryItem & { gramsUsed: number } => {
    return ["COMPLETED", "FAILED", "STOPPED"].includes(item.status) && typeof item.gramsUsed === "number" && item.gramsUsed > 0;
  });
}

export function planCompletedPrintAssignments(input: {
  rollCostCents: number;
  completedPrints: CompletedPrinterHistoryItem[];
  assignedIds: string[];
  ignoredIds: string[];
}) {
  const completed = filterCompletedPrinterHistory(input.completedPrints);
  const assignedPrints = completed
    .filter((print) => input.assignedIds.includes(print.id) && !input.ignoredIds.includes(print.id))
    .map((print) => ({ id: print.id, name: print.name, gramsUsed: print.gramsUsed, completedAt: print.completedAt }));
  const ignoredPrints = completed
    .filter((print) => input.ignoredIds.includes(print.id))
    .map((print) => ({ id: print.id, name: print.name, gramsUsed: print.gramsUsed, completedAt: print.completedAt }));

  return {
    assignedPrints,
    ignoredPrints,
    usage: calculateFilamentRollUsage({
      startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
      rollCostCents: input.rollCostCents,
      assignedPrints
    })
  };
}

export function planFilamentStockAssignments(input: {
  spools: FilamentStockRoll[];
  completedPrints: CompletedPrinterHistoryItem[];
  assignments: Record<string, string | undefined>;
  ignoredIds: string[];
}) {
  const completed = filterCompletedPrinterHistory(input.completedPrints);
  const ignoredPrints = completed
    .filter((print) => input.ignoredIds.includes(print.id))
    .map((print) => ({ id: print.id, name: print.name, gramsUsed: print.gramsUsed, completedAt: print.completedAt }));

  return {
    spools: input.spools.map((spool) => {
      const assignedPrints = completed
        .filter((print) => input.assignments[print.id] === spool.localId && !input.ignoredIds.includes(print.id))
        .map((print) => ({ id: print.id, name: print.name, gramsUsed: print.gramsUsed, completedAt: print.completedAt }));

      return {
        ...spool,
        assignedPrints,
        usage: calculateFilamentRollUsage({
          startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
          rollCostCents: spool.rollCostCents ?? 0,
          assignedPrints
        })
      };
    }),
    ignoredPrints
  };
}
