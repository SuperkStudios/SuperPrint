type QueuedJob = {
  status: string;
  filament?: { material: string } | null;
};

type CandidatePrinter = {
  id: string;
  heartbeatStatus: string;
  status: string;
  supportedMaterials: unknown;
  currentFilament?: { material: string; remainingGrams: number; thresholdGrams: number } | null;
  openMaintenanceTasks: number;
};

export function assignQueuedJobToPrinter(job: QueuedJob, printers: CandidatePrinter[]) {
  if (job.status !== "QUEUED") {
    return { printerId: null, blockedReason: "Only queued jobs can be prepared" };
  }

  const requiredMaterial = job.filament?.material;
  const eligible = printers.find((printer) => {
    const supportedMaterials = Array.isArray(printer.supportedMaterials) ? printer.supportedMaterials.map(String) : [];
    return (
      printer.heartbeatStatus === "ONLINE" &&
      printer.status !== "OFFLINE" &&
      printer.status !== "MAINTENANCE" &&
      printer.openMaintenanceTasks === 0 &&
      (!requiredMaterial || supportedMaterials.includes(requiredMaterial)) &&
      (!requiredMaterial || printer.currentFilament?.material === requiredMaterial) &&
      (!printer.currentFilament || printer.currentFilament.remainingGrams > printer.currentFilament.thresholdGrams)
    );
  });

  if (!eligible) {
    return {
      printerId: null,
      blockedReason: "No eligible online printer with compatible filament and clear maintenance"
    };
  }

  return { printerId: eligible.id, blockedReason: null };
}
