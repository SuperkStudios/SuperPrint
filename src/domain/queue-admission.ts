export function evaluateQueueAdmission(
  slice: {
    status: string;
    estimatedGrams: number | null;
    estimatedPrintMinutes: number | null;
    material: string;
  },
  printer: {
    id: string;
    heartbeatStatus: string;
    status: string;
    supportedMaterials: unknown;
    openMaintenanceTasks: number;
    currentFilament: { id: string; material: string; remainingGrams: number; thresholdGrams: number } | null;
  }
) {
  if (slice.status !== "READY") {
    return { admitted: false as const, blockedReason: "Only ready slice jobs can be admitted to queue" };
  }
  if (printer.heartbeatStatus !== "ONLINE") {
    return { admitted: false as const, blockedReason: "Printer is not online" };
  }
  if (printer.status === "OFFLINE" || printer.status === "MAINTENANCE") {
    return { admitted: false as const, blockedReason: "Printer is not available" };
  }
  if (printer.openMaintenanceTasks > 0) {
    return { admitted: false as const, blockedReason: "Printer has open maintenance" };
  }
  const supported = Array.isArray(printer.supportedMaterials) ? printer.supportedMaterials.map(String) : [];
  if (!supported.includes(slice.material)) {
    return { admitted: false as const, blockedReason: "Printer does not support selected material" };
  }
  if (!printer.currentFilament || printer.currentFilament.material !== slice.material) {
    return { admitted: false as const, blockedReason: "Active filament is not compatible" };
  }
  const reservedGrams = slice.estimatedGrams ?? 0;
  if (reservedGrams <= 0) {
    return { admitted: false as const, blockedReason: "Slice is missing filament estimate" };
  }
  if (printer.currentFilament.remainingGrams - reservedGrams <= printer.currentFilament.thresholdGrams) {
    return { admitted: false as const, blockedReason: "Insufficient filament remaining" };
  }

  return {
    admitted: true as const,
    printerId: printer.id,
    filamentId: printer.currentFilament.id,
    reservedGrams,
    etaMinutes: slice.estimatedPrintMinutes ?? 0
  };
}
