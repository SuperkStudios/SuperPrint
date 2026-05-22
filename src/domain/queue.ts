import { publicPrintTelemetry } from "./telemetry";

export type PrintJobStatus =
  | "QUEUED"
  | "READY_ON_NODE"
  | "AWAITING_OPERATOR_START"
  | "PRINTING"
  | "PAUSED"
  | "COMPLETED"
  | "STOPPED"
  | "FAILED"
  | "CANCELED";

export type QueueJob = {
  id: string;
  status: PrintJobStatus;
  queuePosition: number | null;
  etaMinutes?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failureReason?: string | null;
};

export function reorderQueue<T extends QueueJob>(jobs: T[], orderedIds: string[]): T[] {
  const queuedJobs = jobs.filter((job) => job.status === "QUEUED");
  const queuedIds = queuedJobs.map((job) => job.id).sort();
  const requestedIds = [...orderedIds].sort();

  if (
    queuedIds.length !== requestedIds.length ||
    queuedIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new Error("Queue order must contain each queued job exactly once");
  }

  const byId = new Map(queuedJobs.map((job) => [job.id, job]));
  return orderedIds.map((id, index) => ({
    ...byId.get(id)!,
    queuePosition: index + 1
  }));
}

export function markPrintStarted<T extends QueueJob>(job: T, startedAt = new Date()): T {
  if (job.status !== "AWAITING_OPERATOR_START") {
    throw new Error("Only operator-approved jobs can be started");
  }

  return {
    ...job,
    status: "PRINTING",
    startedAt,
    queuePosition: 0
  };
}

export function markPrintCompleted<T extends QueueJob>(job: T, completedAt = new Date()): T {
  if (job.status !== "PRINTING") {
    throw new Error("Only printing jobs can be completed");
  }

  return {
    ...job,
    status: "COMPLETED",
    completedAt,
    queuePosition: null
  };
}

export function markPrintFailed<T extends QueueJob>(
  job: T,
  failureReason: string,
  completedAt = new Date()
): T {
  if (job.status !== "PRINTING") {
    throw new Error("Only printing jobs can fail");
  }

  return {
    ...job,
    status: "FAILED",
    completedAt,
    failureReason,
    queuePosition: null
  };
}

export function markPrintPaused<T extends QueueJob>(job: T, completedAt = new Date()): T {
  if (job.status !== "PRINTING") {
    throw new Error("Only printing jobs can be paused");
  }

  return {
    ...job,
    status: "PAUSED",
    completedAt,
    queuePosition: null
  };
}

export function markPrintStopped<T extends QueueJob>(job: T, completedAt = new Date()): T {
  if (job.status !== "PRINTING") {
    throw new Error("Only printing jobs can be stopped");
  }

  return {
    ...job,
    status: "STOPPED",
    completedAt,
    queuePosition: null
  };
}

export function markPrintRequeued<T extends QueueJob>(job: T, queuePosition: number): T {
  if (job.status !== "PAUSED" && job.status !== "FAILED" && job.status !== "STOPPED") {
    throw new Error("Only paused, stopped, or failed jobs can be requeued");
  }

  return {
    ...job,
    status: "QUEUED",
    queuePosition,
    startedAt: null,
    completedAt: null,
    failureReason: null
  };
}

export function publicQueueJob(job: {
  id: string;
  status: string;
  queuePosition: number | null;
  etaMinutes: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  streamUrl: string | null;
  order: { orderNumber: string };
  printer: ({ publicName: string; status: string; healthDescription: string } & Record<string, unknown>) | null;
  filament: { material: string; color: string; remainingGrams: number; thresholdGrams: number } | null;
  currentLayer?: number | null;
  progressPercent?: number | null;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
  nozzleTempC?: number | null;
  bedTempC?: number | null;
  telemetryUpdatedAt?: Date | null;
}) {
  const progressPercent = job.progressPercent ?? 0;

  return {
    id: job.id,
    orderNumber: job.order.orderNumber,
    status: job.status,
    queuePosition: job.queuePosition,
    etaMinutes: job.etaMinutes,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    progressPercent,
    streamUrl: job.streamUrl,
    telemetry: publicPrintTelemetry(job),
    printer: job.printer
      ? {
          name: job.printer.publicName,
          status: job.printer.status,
          healthDescription: job.printer.healthDescription
        }
      : null,
    filament: job.filament
      ? {
          material: job.filament.material,
          color: job.filament.color,
          remainingGrams: job.filament.remainingGrams,
          low: job.filament.remainingGrams <= job.filament.thresholdGrams
        }
      : null
  };
}
