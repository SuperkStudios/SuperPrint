import { randomUUID } from "node:crypto";
import {
  markPrintCompleted,
  markPrintFailed,
  markPrintPaused,
  markPrintRequeued,
  markPrintStarted,
  publicQueueJob,
  reorderQueue
} from "../domain/queue";
import { assignQueuedJobToPrinter } from "../domain/queue-preparation";
import { enqueuePrintJob } from "../lib/queue-broker";
import { prisma } from "../lib/prisma";
import { recordPlatformEvent } from "./events";

export async function getPublicQueueState() {
  const [current, nextJobs, printers] = await Promise.all([
    prisma.printJob.findFirst({
      where: { status: "PRINTING" },
      include: { order: true, printer: true, filament: true },
      orderBy: { startedAt: "desc" }
    }),
    prisma.printJob.findMany({
      where: { status: "QUEUED" },
      include: { order: true, printer: true, filament: true },
      orderBy: { queuePosition: "asc" },
      take: 8
    }),
    prisma.printer.findMany({
      include: { currentFilament: true },
      orderBy: { publicName: "asc" }
    })
  ]);

  return {
    current: current ? publicQueueJob(current) : null,
    nextJobs: nextJobs.map(publicQueueJob),
    printers: printers.map((printer) => ({
      id: printer.id,
      name: printer.publicName,
      status: printer.status,
      healthDescription: printer.healthDescription,
      filament: printer.currentFilament
        ? {
            material: printer.currentFilament.material,
            color: printer.currentFilament.color,
            remainingGrams: printer.currentFilament.remainingGrams,
            low: printer.currentFilament.remainingGrams <= printer.currentFilament.thresholdGrams
          }
        : null
    }))
  };
}

export async function getAdminQueueState() {
  return prisma.printJob.findMany({
    include: { order: { include: { customer: true, product: true, upload: true } }, printer: true, filament: true },
    orderBy: [{ status: "asc" }, { queuePosition: "asc" }]
  });
}

export async function reorderPrintQueue(orderedIds: string[]) {
  const queuedJobs = await prisma.printJob.findMany({ where: { status: "QUEUED" } });
  const reordered = reorderQueue(queuedJobs, orderedIds);

  await prisma.$transaction(
    reordered.map((job) =>
      prisma.printJob.update({
        where: { id: job.id },
        data: { queuePosition: job.queuePosition }
      })
    )
  );

  return reordered;
}

export async function startPrintJob(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const next = markPrintStarted(job);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      startedAt: next.startedAt,
      queuePosition: next.queuePosition
    },
    include: { order: true, printer: true }
  });

  await enqueuePrintJob(printJobId);
  await recordPlatformEvent({
    type: "PRINT_STARTED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      printerInternalIp: updated.printer?.internalIp,
      status: updated.status,
      etaMinutes: updated.etaMinutes
    }
  });

  return updated;
}

export async function completePrintJob(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const next = markPrintCompleted(job);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      queuePosition: next.queuePosition,
      order: { update: { status: "COMPLETED" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_COMPLETED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: updated.status
    }
  });

  return updated;
}

export async function failPrintJob(printJobId: string, reason: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const next = markPrintFailed(job, reason);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      failureReason: next.failureReason,
      queuePosition: next.queuePosition,
      order: { update: { status: "FAILED" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_FAILED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: updated.status,
      failureReason: reason,
      adminNotes: "Review printer logs before requeue"
    }
  });

  return updated;
}

export async function pausePrintJob(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const next = markPrintPaused(job);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      queuePosition: next.queuePosition,
      order: { update: { status: "QUEUED" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_PAUSED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: "PAUSED",
      failureReason: "Paused by operator"
    }
  });

  return updated;
}

export async function requeuePrintJob(printJobId: string, actorId?: string) {
  const [job, lastQueued] = await Promise.all([
    prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } }),
    prisma.printJob.findFirst({ where: { status: "QUEUED" }, orderBy: { queuePosition: "desc" } })
  ]);
  const next = markPrintRequeued(job, (lastQueued?.queuePosition ?? 0) + 1);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      queuePosition: next.queuePosition,
      startedAt: null,
      completedAt: null,
      failureReason: null,
      order: { update: { status: "QUEUED" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_REQUEUED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: "REQUEUED",
      queuePosition: updated.queuePosition
    }
  });

  return updated;
}

export async function prepareNextQueuedJob() {
  const lockToken = randomUUID();
  const locked = await prisma.$transaction(async (tx) => {
    const job = await tx.printJob.findFirst({
      where: { status: "QUEUED", queueLockedAt: null },
      orderBy: { queuePosition: "asc" }
    });
    if (!job) return null;
    return tx.printJob.update({
      where: { id: job.id },
      data: { queueLockedAt: new Date(), queueLockToken: lockToken }
    });
  });

  if (!locked) {
    return null;
  }

  const [job, printers] = await Promise.all([
    prisma.printJob.findUniqueOrThrow({
      where: { id: locked.id },
      include: { filament: true }
    }),
    prisma.printer.findMany({
      include: {
        currentFilament: true,
        maintenanceTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } }
      },
      orderBy: { publicName: "asc" }
    })
  ]);

  const assignment = assignQueuedJobToPrinter(
    { status: job.status, filament: job.filament },
    printers.map((printer) => ({
      id: printer.id,
      heartbeatStatus: printer.heartbeatStatus,
      status: printer.status,
      supportedMaterials: printer.supportedMaterials,
      currentFilament: printer.currentFilament,
      openMaintenanceTasks: printer.maintenanceTasks.length
    }))
  );

  await prisma.printJob.updateMany({
    where: { id: job.id, queueLockToken: lockToken },
    data: {
      printerId: assignment.printerId,
      assignedAt: assignment.printerId ? new Date() : null,
      assignmentBlockedReason: assignment.blockedReason,
      queueLockedAt: null,
      queueLockToken: null
    }
  });
  return prisma.printJob.findUnique({ where: { id: job.id } });
}
