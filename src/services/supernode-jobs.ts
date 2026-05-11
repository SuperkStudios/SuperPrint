import { readFile } from "node:fs/promises";
import { acknowledgeJobReadyOnNode } from "../domain/node-handoff";
import { ManualNoopPrinterControlAdapter } from "../domain/printer-control";
import { compareNodeSecret } from "../domain/supernode-auth";
import { resolveLocalStoragePath } from "../lib/storage";
import { prisma } from "../lib/prisma";
import { recordPlatformEvent } from "./events";

export async function authenticateSuperNode(nodeId: string, bearer: string) {
  const node = await prisma.superNode.findUnique({ where: { nodeId } });
  if (!node || !bearer || !(await compareNodeSecret(bearer, node.secretHash))) {
    throw new Error("Invalid SuperNode credentials");
  }
  return node;
}

export async function listPrinterReadyJobsForNode(nodeId: string, bearer: string) {
  const node = await authenticateSuperNode(nodeId, bearer);
  if (!node.printerId) return [];
  const jobs = await prisma.printJob.findMany({
    where: {
      status: "QUEUED",
      printerId: node.printerId,
      readyOnNodeAt: null,
      sliceJob: { status: "READY", outputStorageKey: { not: null } }
    },
    include: { order: true, sliceJob: true, filament: true },
    orderBy: { queuePosition: "asc" },
    take: 3
  });
  return jobs.map((job) => ({
    id: job.id,
    orderNumber: job.order.orderNumber,
    etaMinutes: job.etaMinutes,
    material: job.filament?.material,
    downloadUrl: `/api/supernode/jobs/${job.id}/gcode?nodeId=${encodeURIComponent(nodeId)}`
  }));
}

export async function readGcodeForNodeJob(printJobId: string, nodeId: string, bearer: string) {
  const node = await authenticateSuperNode(nodeId, bearer);
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { sliceJob: true } });
  if (job.printerId !== node.printerId || !job.sliceJob?.outputStorageKey) {
    throw new Error("Job is not available to this node");
  }
  return readFile(resolveLocalStoragePath(job.sliceJob.outputStorageKey));
}

export async function acknowledgeNodeReady(printJobId: string, nodeId: string, bearer: string, localJobPath: string) {
  const node = await authenticateSuperNode(nodeId, bearer);
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  const transition = acknowledgeJobReadyOnNode(job, { nodeId, printerId: node.printerId, localJobPath });
  const updated = await prisma.printJob.update({ where: { id: printJobId }, data: transition });
  await recordPlatformEvent({
    type: "JOB_READY_ON_NODE",
    payload: {
      orderNumber: job.order.orderNumber,
      printerName: job.printer?.publicName,
      status: "READY_ON_NODE",
      internalNodeId: nodeId,
      nodeLocalJobPath: localJobPath
    }
  });
  return updated;
}

export async function listApprovedPrintCommandsForNode(nodeId: string, bearer: string) {
  const node = await authenticateSuperNode(nodeId, bearer);
  if (!node.printerId) return [];
  const jobs = await prisma.printJob.findMany({
    where: {
      status: "AWAITING_OPERATOR_START",
      printerId: node.printerId,
      printCommandAcknowledgedAt: null
    },
    include: { order: true },
    orderBy: { operatorStartApprovedAt: "asc" },
    take: 1
  });

  return jobs.map((job) => ({
    id: job.id,
    orderNumber: job.order.orderNumber,
    adapter: "manual-noop",
    localJobPath: job.nodeLocalJobPath
  }));
}

export async function acknowledgePrintCommand(printJobId: string, nodeId: string, bearer: string) {
  const node = await authenticateSuperNode(nodeId, bearer);
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id: printJobId }, include: { order: true, printer: true } });
  if (job.status !== "AWAITING_OPERATOR_START" || job.printerId !== node.printerId || !job.nodeLocalJobPath) {
    throw new Error("Print command is not available to this node");
  }

  const adapter = new ManualNoopPrinterControlAdapter();
  const ack = await adapter.startPrint({ printJobId, gcodeLocalPath: job.nodeLocalJobPath });
  const now = new Date();
  const updated = await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: "PRINTING",
      startedAt: now,
      queuePosition: 0,
      printCommandAcknowledgedAt: now,
      printCommandAcknowledgedByNodeId: nodeId,
      order: { update: { status: "PRINTING" } }
    }
  });

  await recordPlatformEvent({
    type: "PRINT_COMMAND_ACKNOWLEDGED",
    payload: {
      orderNumber: job.order.orderNumber,
      printerName: job.printer?.publicName,
      status: "PRINTING",
      adapter: ack.mode,
      internalNodeId: nodeId,
      nodeLocalJobPath: job.nodeLocalJobPath
    }
  });
  await recordPlatformEvent({
    type: "PRINT_STARTED",
    payload: {
      orderNumber: job.order.orderNumber,
      printerName: job.printer?.publicName,
      status: "PRINTING",
      etaMinutes: job.etaMinutes
    }
  });

  return updated;
}
