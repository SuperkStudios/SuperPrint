import { evaluateQueueAdmission } from "../domain/queue-admission";
import { prisma } from "../lib/prisma";
import { recordPlatformEvent } from "./events";
import { optimizeQueueForLoadedFilament } from "./queue";

export async function admitSliceJobToQueue(sliceJobId: string, actorId: string) {
  const sliceJob = await prisma.sliceJob.findUniqueOrThrow({
    where: { id: sliceJobId },
    include: {
      upload: true,
      filamentProfile: true
    }
  });
  const selectedPrinterId = sliceJob.upload.selectedPrinterId;
  if (!selectedPrinterId) {
    throw new Error("Upload has no selected printer");
  }
  const printer = await prisma.printer.findUniqueOrThrow({
    where: { id: selectedPrinterId },
    include: {
      currentFilament: true,
      maintenanceTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } }
    }
  });
  const admission = evaluateQueueAdmission(
    {
      status: sliceJob.status,
      estimatedGrams: sliceJob.estimatedGrams,
      estimatedPrintMinutes: sliceJob.estimatedPrintMinutes,
      material: sliceJob.filamentProfile.material
    },
    {
      id: printer.id,
      heartbeatStatus: printer.heartbeatStatus,
      status: printer.status,
      supportedMaterials: printer.supportedMaterials,
      openMaintenanceTasks: printer.maintenanceTasks.length,
      currentFilament: printer.currentFilament
    }
  );

  if (!admission.admitted) {
    throw new Error(admission.blockedReason);
  }

  const lastQueued = await prisma.printJob.findFirst({ where: { status: "QUEUED" }, orderBy: { queuePosition: "desc" } });
  const result = await prisma.$transaction(async (tx) => {
    const order =
      (await tx.order.findFirst({ where: { uploadId: sliceJob.uploadId } })) ??
      (await tx.order.create({
        data: {
          orderNumber: `SP-${Date.now().toString().slice(-6)}`,
          customerId: sliceJob.upload.customerId,
          uploadId: sliceJob.uploadId,
          totalCents: sliceJob.upload.estimatedPriceCents ?? 0,
          status: "QUEUED",
          paymentStatus: "PENDING"
        }
      }));
    await tx.order.update({ where: { id: order.id }, data: { status: "QUEUED" } });
    await tx.filamentSpool.update({
      where: { id: admission.filamentId },
      data: { remainingGrams: { decrement: admission.reservedGrams } }
    });
    const printJob = await tx.printJob.create({
      data: {
        orderId: order.id,
        printerId: admission.printerId,
        filamentId: admission.filamentId,
        sliceJobId,
        status: "QUEUED",
        queuePosition: (lastQueued?.queuePosition ?? 0) + 1,
        etaMinutes: admission.etaMinutes,
        reservedFilamentGrams: admission.reservedGrams
      }
    });
    return { order, printJob };
  });

  await recordPlatformEvent({
    type: "QUEUE_ADMITTED",
    actorId,
    payload: {
      orderNumber: result.order.orderNumber,
      sliceJobId,
      printerName: printer.publicName,
      estimatedPrintMinutes: admission.etaMinutes,
      reservedGrams: admission.reservedGrams
    }
  });

  await optimizeQueueForLoadedFilament(actorId);

  return result;
}
