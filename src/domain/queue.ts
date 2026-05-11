export type PrintJobStatus = "QUEUED" | "PRINTING" | "COMPLETED" | "FAILED" | "CANCELED";

export type QueueJob = {
  id: string;
  status: PrintJobStatus;
  queuePosition: number | null;
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
  if (job.status !== "QUEUED") {
    throw new Error("Only queued jobs can be started");
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
