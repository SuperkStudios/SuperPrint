export type PrintAnomalyType = "SPAGHETTI" | "WRONG_PRINT" | "LAYER_SHIFT" | "THERMAL" | "UNKNOWN";

export type PrintAnomalyInput = {
  type: PrintAnomalyType;
  confidence: number;
  printJobId: string;
  printerId: string;
};

export function planPrintAnomalyResponse(input: PrintAnomalyInput) {
  const critical = input.confidence >= 0.85 || input.type === "THERMAL";
  const warning = input.confidence >= 0.65;
  const label = anomalyLabel(input.type);

  if (critical) {
    return {
      severity: "critical" as const,
      printerAction: "stop" as const,
      markJobFailed: true,
      printerStatus: "MAINTENANCE" as const,
      notificationTitle: `${label} detected`,
      maintenanceTask: {
        printerId: input.printerId,
        title: "Check bed and recover failed print",
        description: "Clear spaghetti or failed material, inspect the bed and hotend, verify the nozzle is clean, rerun calibration if needed, then resume the queue manually."
      }
    };
  }

  if (warning) {
    return {
      severity: "warning" as const,
      printerAction: "pause" as const,
      markJobFailed: false,
      printerStatus: "WARNING" as const,
      notificationTitle: `${label} warning`,
      maintenanceTask: null
    };
  }

  return {
    severity: "watch" as const,
    printerAction: "notify" as const,
    markJobFailed: false,
    printerStatus: "WARNING" as const,
    notificationTitle: `${label} watch`,
    maintenanceTask: null
  };
}

function anomalyLabel(type: PrintAnomalyType) {
  if (type === "SPAGHETTI") return "Spaghetti print";
  if (type === "WRONG_PRINT") return "Wrong print";
  if (type === "LAYER_SHIFT") return "Layer shift";
  if (type === "THERMAL") return "Thermal anomaly";
  return "Print anomaly";
}
