export function publicPrintTelemetry(input: {
  currentLayer?: number | null;
  progressPercent?: number | null;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
  nozzleTempC?: number | null;
  bedTempC?: number | null;
  telemetryUpdatedAt?: Date | string | null;
}) {
  if (!input.telemetryUpdatedAt && input.progressPercent == null && input.currentLayer == null) {
    return { state: "WAITING_FOR_TELEMETRY" as const };
  }

  return {
    state: "LIVE" as const,
    currentLayer: input.currentLayer ?? null,
    progressPercent: input.progressPercent ?? null,
    elapsedSeconds: input.elapsedSeconds ?? null,
    remainingSeconds: input.remainingSeconds ?? null,
    nozzleTempC: input.nozzleTempC ?? null,
    bedTempC: input.bedTempC ?? null,
    telemetryUpdatedAt: input.telemetryUpdatedAt ? new Date(input.telemetryUpdatedAt).toISOString() : null
  };
}
