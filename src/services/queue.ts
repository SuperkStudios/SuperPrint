import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  markPrintCompleted,
  markPrintFailed,
  markPrintPaused,
  markPrintRequeued,
  markPrintStarted,
  markPrintStopped,
  publicQueueJob,
  reorderQueue
} from "../domain/queue";
import { approveOperatorPrintStart, type OperatorStartChecklist } from "../domain/operator-start";
import { completePrintingJobAccounting, failPrintingJobAccounting, stopPrintingJobAccounting } from "../domain/print-completion";
import { assignQueuedJobToPrinter } from "../domain/queue-preparation";
import { CentauriPrinterControlAdapter } from "../domain/printer-control";
import { planMaterialAwareQueue } from "../domain/material-queue-planner";
import { enqueuePrintJob } from "../lib/queue-broker";
import { prisma } from "../lib/prisma";
import { resolveLocalStoragePath } from "../lib/storage";
import { recordPlatformEvent } from "./events";
import { attachCompletedPrintTimelapse } from "./timelapse-media";

export async function getPublicQueueState() {
  const [current, nextJobs, printers] = await Promise.all([
    prisma.printJob.findFirst({
      where: { status: "PRINTING" },
      include: { order: true, printer: true, filament: true },
      orderBy: { startedAt: "desc" }
    }),
    prisma.printJob.findMany({
      where: { status: { in: ["QUEUED", "READY_ON_NODE"] } },
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

export async function optimizeQueueForLoadedFilament(actorId?: string) {
  const [printer, queuedJobs] = await Promise.all([
    prisma.printer.findFirst({
      where: { currentFilamentId: { not: null }, status: { not: "OFFLINE" } },
      include: { currentFilament: true },
      orderBy: { publicName: "asc" }
    }),
    prisma.printJob.findMany({
      where: { status: "QUEUED" },
      include: { filament: true },
      orderBy: { queuePosition: "asc" }
    })
  ]);

  const plan = planMaterialAwareQueue({
    currentMaterial: printer?.currentFilament?.material,
    jobs: queuedJobs.map((job) => ({
      id: job.id,
      queuePosition: job.queuePosition,
      material: job.filament?.material
    }))
  });

  if (plan.orderedJobIds.length > 1) {
    await reorderPrintQueue(plan.orderedJobIds);
  }

  let task = null;
  if (printer && plan.requiredFilamentChange) {
    const title = `Change filament to ${plan.requiredFilamentChange.toMaterial}`;
    const existing = await prisma.maintenanceTask.findFirst({
      where: {
        printerId: printer.id,
        title,
        status: { in: ["OPEN", "IN_PROGRESS"] }
      }
    });
    task = existing ?? await prisma.maintenanceTask.create({
      data: {
        printerId: printer.id,
        title,
        description: `${plan.requiredFilamentChange.reason}. Load the requested spool, purge until color/material is clean, update the printer's active filament, then resume the queue.`,
        dueAt: new Date()
      }
    });
    await recordPlatformEvent({
      type: "MAINTENANCE_DUE",
      actorId,
      payload: {
        printerId: printer.id,
        title,
        reason: plan.requiredFilamentChange.reason
      }
    });
  }

  return { plan, task };
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

export async function approvePhysicalPrintStart(printJobId: string, checklist: OperatorStartChecklist, actorId: string) {
  const job = await prisma.printJob.findUniqueOrThrow({
    where: { id: printJobId },
    include: { order: true, printer: true }
  });
  const next = approveOperatorPrintStart(job, { operatorId: actorId, checklist });

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      operatorStartApprovedById: next.operatorStartApprovedById,
      operatorStartApprovedAt: next.operatorStartApprovedAt,
      operatorStartChecklist: next.operatorStartChecklist as unknown as Prisma.InputJsonObject
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "OPERATOR_PRINT_START_APPROVED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: updated.status,
      checklistConfirmed: true,
      adminNotes: "Physical print start approved by operator checklist"
    }
  });

  return updated;
}

export async function completePrintJob(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const next = markPrintCompleted(job);
  const accounting = completePrintingJobAccounting(job);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      queuePosition: next.queuePosition,
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      printer: job.printerId
        ? {
            update: {
              totalRuntimeMinutes: { increment: accounting.runtimeMinutes },
              completedPrintCount: { increment: accounting.completedPrintIncrement }
            }
          }
        : undefined,
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
      status: updated.status,
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      runtimeMinutes: accounting.runtimeMinutes
    }
  });
  void attachCompletedPrintTimelapse(printJobId).catch((error) => {
    console.error("Could not attach completed print timelapse", error);
  });

  return updated;
}

export async function failPrintJob(printJobId: string, reason: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const accounting = failPrintingJobAccounting({
    status: job.status,
    reason,
    reservedFilamentGrams: job.reservedFilamentGrams,
    elapsedSeconds: job.elapsedSeconds
  });
  const next = markPrintFailed(job, accounting.failureReason);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      failureReason: next.failureReason,
      queuePosition: next.queuePosition,
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      printer: job.printerId
        ? {
            update: {
              failedPrintCount: { increment: accounting.failedPrintIncrement },
              totalRuntimeMinutes: { increment: accounting.runtimeMinutes }
            }
          }
        : undefined,
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
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      runtimeMinutes: accounting.runtimeMinutes,
      failureReason: accounting.failureReason,
      adminNotes: "Review printer logs before requeue"
    }
  });

  return updated;
}

export async function stopPrintJob(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const accounting = stopPrintingJobAccounting({
    status: job.status,
    reservedFilamentGrams: job.reservedFilamentGrams,
    elapsedSeconds: job.elapsedSeconds
  });
  const next = markPrintStopped(job);

  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: next.status,
      completedAt: next.completedAt,
      queuePosition: next.queuePosition,
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      printer: job.printerId
        ? {
            update: {
              totalRuntimeMinutes: { increment: accounting.runtimeMinutes }
            }
          }
        : undefined,
      order: { update: { status: "STOPPED" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_STOPPED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: "STOPPED",
      consumedFilamentGrams: accounting.consumedFilamentGrams,
      runtimeMinutes: accounting.runtimeMinutes,
      adminNotes: "Stopped by operator; counted as interrupted, not failed"
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
      where: { status: "QUEUED", queueLockedAt: null, assignmentBlockedReason: null },
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

export async function startAssignedQueuedJobOnPrinter(printJobId: string, actorId?: string) {
  const job = await prisma.printJob.findUniqueOrThrow({
    where: { id: printJobId },
    include: { order: { include: { product: true } }, printer: true, sliceJob: true }
  });
  if (!["QUEUED", "READY_ON_NODE"].includes(job.status) || !job.printerId || !job.printer) {
    return job;
  }
  if (process.env.CENTAURI_DIRECT_START_ENABLED !== "true") {
    return prisma.printJob.update({
      where: { id: printJobId },
      data: {
        assignmentBlockedReason: "Direct Centauri printer start is disabled. Verify G-code on the printer and clear this hold before enabling CENTAURI_DIRECT_START_ENABLED."
      }
    });
  }

  const gcodeLocalPath = resolveDispatchableGcodePath(job);
  if (!gcodeLocalPath) {
    return prisma.printJob.update({
      where: { id: printJobId },
      data: {
        assignmentBlockedReason: "No dispatchable G-code is attached. Store products must be pre-sliced or have a ready slice before automatic printer start."
      }
    });
  }

  const adapter = new CentauriPrinterControlAdapter({ controlApiUrl: job.printer.controlApiUrl });
  let ack: Awaited<ReturnType<CentauriPrinterControlAdapter["startPrint"]>>;
  try {
    ack = await adapter.startPrint({ printJobId, gcodeLocalPath });
  } catch (error) {
    return prisma.printJob.update({
      where: { id: printJobId },
      data: {
        assignmentBlockedReason: `Automatic printer start failed: ${error instanceof Error ? error.message : String(error)}`
      }
    });
  }
  const now = new Date();
  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: "PRINTING",
      startedAt: now,
      queuePosition: 0,
      assignmentBlockedReason: null,
      nodeLocalJobPath: gcodeLocalPath,
      printCommandAcknowledgedAt: now,
      printCommandAcknowledgedByNodeId: "direct-worker",
      order: { update: { status: "PRINTING" } }
    },
    include: { order: true, printer: true }
  });

  await recordPlatformEvent({
    type: "PRINT_COMMAND_ACKNOWLEDGED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: "PRINTING",
      adapter: ack.mode,
      nodeLocalJobPath: gcodeLocalPath
    }
  });
  await recordPlatformEvent({
    type: "PRINT_STARTED",
    actorId,
    payload: {
      orderNumber: updated.order.orderNumber,
      printerName: updated.printer?.publicName,
      status: "PRINTING",
      etaMinutes: updated.etaMinutes
    }
  });

  return updated;
}

function resolveDispatchableGcodePath(job: {
  nodeLocalJobPath: string | null;
  sliceJob: { outputStorageKey: string | null } | null;
  order: { product: { productFileStorageKey: string | null } | null };
}) {
  if (job.nodeLocalJobPath) return job.nodeLocalJobPath;
  if (job.sliceJob?.outputStorageKey) return resolveLocalStoragePath(job.sliceJob.outputStorageKey);
  const productFile = job.order.product?.productFileStorageKey;
  if (productFile && /\.(gcode|gco|g)$/i.test(productFile)) return resolveLocalStoragePath(productFile);
  return null;
}
