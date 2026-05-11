export function completePrintingJobAccounting(job: {
  status: string;
  reservedFilamentGrams?: number | null;
  elapsedSeconds?: number | null;
}) {
  if (job.status !== "PRINTING") {
    throw new Error("Only printing jobs can be completed");
  }
  return {
    consumedFilamentGrams: job.reservedFilamentGrams ?? 0,
    runtimeMinutes: Math.max(0, Math.round((job.elapsedSeconds ?? 0) / 60)),
    completedPrintIncrement: 1
  };
}

export function failPrintingJobAccounting(input: { status: string; reason: string; requeue?: boolean }) {
  if (input.status !== "PRINTING") {
    throw new Error("Only printing jobs can fail");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Failure reason is required");
  }
  return {
    failureReason: reason,
    requeue: input.requeue === true,
    failedPrintIncrement: 1
  };
}
