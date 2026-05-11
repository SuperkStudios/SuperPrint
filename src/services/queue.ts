import { markPrintCompleted, markPrintFailed, markPrintStarted, reorderQueue } from "@/domain/queue";
import { prisma } from "@/lib/prisma";
import { enqueuePrintJob } from "@/lib/queue-broker";
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
    current: current ? publicJob(current) : null,
    nextJobs: nextJobs.map(publicJob),
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

function publicJob(job: {
  id: string;
  status: string;
  queuePosition: number | null;
  etaMinutes: number;
  streamUrl: string | null;
  order: { orderNumber: string };
  printer: { publicName: string; status: string; healthDescription: string } | null;
  filament: { material: string; color: string; remainingGrams: number; thresholdGrams: number } | null;
}) {
  return {
    id: job.id,
    orderNumber: job.order.orderNumber,
    status: job.status,
    queuePosition: job.queuePosition,
    etaMinutes: job.etaMinutes,
    streamUrl: job.streamUrl,
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
