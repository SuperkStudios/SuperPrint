import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { hasUsableSlicerEstimate, planProductionPlateOrder } from "@/domain/production-loop";
import { getPartProductionPlanner } from "./part-planner";
import { authenticateSuperNode } from "./supernode-jobs";

const activePlateStatuses = ["PLANNED", "SLICING", "READY", "NEEDS_FILAMENT", "PRINTING"] as const;

export async function rebuildProductionPlateJobs(actorId?: string) {
  const planner = await getPartProductionPlanner();
  await prisma.productionPlateJob.updateMany({
    where: { status: { in: [...activePlateStatuses] } },
    data: { status: "CANCELED", lastError: "Rebuilt from current paid order demand." }
  });

  const jobs = [];
  for (const row of planner.filter((item) => item.quantityToPrint > 0)) {
    const part = await prisma.productPart.findUniqueOrThrow({
      where: { id: row.partId },
      include: { product: { include: { allowedFilaments: { include: { filamentMaterial: true } } } } }
    });
    const filament = chooseFilamentForColor(part.product.allowedFilaments.map((item) => item.filamentMaterial), row.color);
    const maxPerPlate = Math.max(1, row.suggestedPlateQuantity);
    const plateCount = Math.ceil(row.quantityToPrint / maxPerPlate);
    for (let index = 0; index < plateCount; index += 1) {
      const quantityPlanned = Math.min(maxPerPlate, row.quantityToPrint - index * maxPerPlate);
      jobs.push(await prisma.productionPlateJob.create({
        data: {
          productPartId: part.id,
          filamentId: filament?.id,
          color: row.color,
          status: "PLANNED",
          quantityPlanned,
          requiredQuantity: row.requiredQuantity,
          inventoryUsedQuantity: row.quantityOnHand,
          maxPerPlate,
          plateIndex: index + 1,
          plateCount,
          orderRefs: row.orders as unknown as Prisma.InputJsonValue,
          inputStorageKey: part.fileStorageKey
        }
      }));
    }
  }

  void actorId;
  return jobs;
}

export async function getProductionPlateDashboard() {
  const [planner, plateJobs] = await Promise.all([
    getPartProductionPlanner(),
    prisma.productionPlateJob.findMany({
      include: {
        productPart: { include: { product: true } },
        filament: true
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    })
  ]);
  const next = orderProductionPlateJobs(plateJobs).find((job) => ["PLANNED", "SLICING", "READY", "NEEDS_FILAMENT"].includes(job.status));
  return { planner, plateJobs, next };
}

export async function listProductionPlateJobsForNode(nodeId: string, bearer: string) {
  await authenticateSuperNode(nodeId, bearer);
  await prisma.productionPlateJob.updateMany({
    where: { status: "SLICING", updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
    data: { status: "PLANNED", lastError: "Slicing timed out on SuperNode; retrying." }
  });
  const jobs = await prisma.productionPlateJob.findMany({
    where: { status: "PLANNED" },
    include: { productPart: { include: { product: true } }, filament: true },
    orderBy: [{ createdAt: "asc" }]
  });
  const planned = orderProductionPlateJobs(jobs).slice(0, 2);
  if (planned.length) {
    await prisma.productionPlateJob.updateMany({
      where: { id: { in: planned.map((job) => job.id) }, status: "PLANNED" },
      data: { status: "SLICING", lastError: null }
    });
  }
  return planned.map((job) => ({
    id: job.id,
    productName: job.productPart.product.name,
    partName: job.productPart.name,
    color: job.color,
    material: job.filament?.material ?? job.productPart.product.defaultMaterial,
    quantity: job.quantityPlanned,
    maxPerPlate: job.maxPerPlate,
    modelUrl: `/api/supernode/plate-jobs/${job.id}/model?nodeId=${encodeURIComponent(nodeId)}`
  }));
}

export async function readProductionPlateModel(plateJobId: string, nodeId: string, bearer: string) {
  await authenticateSuperNode(nodeId, bearer);
  const job = await prisma.productionPlateJob.findUniqueOrThrow({
    where: { id: plateJobId },
    include: { productPart: true }
  });
  return {
    fileName: path.basename(job.productPart.fileStorageKey),
    file: await readFile(resolveLocalStoragePath(job.productPart.fileStorageKey))
  };
}

export async function acknowledgeProductionPlateSliced(input: {
  plateJobId: string;
  nodeId: string;
  bearer: string;
  localJobPath: string;
  gcodeBase64?: string | null;
  estimatedPrintMinutes?: number | null;
  estimatedGrams?: number | null;
  slicerMessage?: string | null;
}) {
  await authenticateSuperNode(input.nodeId, input.bearer);
  if (!input.gcodeBase64 || !input.estimatedPrintMinutes || !input.estimatedGrams) {
    throw new Error("Sliced production plates must include G-code, estimated minutes, and estimated grams before they can be printed.");
  }
  const outputStorageKey = input.gcodeBase64 ? buildLocalStorageKey("sliced", `${input.plateJobId}.gcode`) : undefined;
  if (outputStorageKey && input.gcodeBase64) {
    const outputPath = resolveLocalStoragePath(outputStorageKey);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(input.gcodeBase64, "base64"));
  }
  return prisma.productionPlateJob.update({
    where: { id: input.plateJobId },
    data: {
      status: "READY",
      nodeLocalJobPath: input.localJobPath,
      outputStorageKey,
      estimatedPrintMinutes: input.estimatedPrintMinutes ?? undefined,
      estimatedGrams: input.estimatedGrams ?? undefined,
      slicerMessage: input.slicerMessage ?? undefined,
      lastError: null
    }
  });
}

export async function updateProductionPlateJobStatus(input: {
  id: string;
  status: "PLANNED" | "SLICING" | "READY" | "NEEDS_FILAMENT" | "PRINTING" | "PRINTED" | "INVENTORIED" | "CANCELED" | "FAILED";
  printedQuantity?: number;
  inventoriedQuantity?: number;
  lastError?: string | null;
}) {
  const existing = await prisma.productionPlateJob.findUnique({ where: { id: input.id } });
  if (input.status === "READY" && existing && !hasUsableSlicerEstimate(existing)) {
    throw new Error("Plate needs a real slicer estimate and G-code before it can be marked ready.");
  }
  return prisma.productionPlateJob.update({
    where: { id: input.id },
    data: {
      status: input.status,
      printedQuantity: input.printedQuantity,
      inventoriedQuantity: input.inventoriedQuantity,
      lastError: input.lastError,
      startedAt: input.status === "PRINTING" ? new Date() : undefined,
      completedAt: ["PRINTED", "INVENTORIED"].includes(input.status) ? new Date() : undefined
    }
  });
}

export function orderProductionPlateJobs<T extends {
  id: string;
  filamentId: string | null;
  color: string;
  quantityPlanned: number;
  createdAt: Date;
  filament?: { material: string; color: string } | null;
}>(jobs: T[], currentFilament?: { id?: string | null; material?: string | null; color?: string | null } | null) {
  const plan = planProductionPlateOrder({
    currentFilamentId: currentFilament?.id,
    currentMaterial: currentFilament?.material,
    currentColor: currentFilament?.color,
    plates: jobs.map((job) => ({
      id: job.id,
      filamentId: job.filamentId,
      material: job.filament?.material,
      color: job.color,
      quantityPlanned: job.quantityPlanned,
      createdAt: job.createdAt
    }))
  });
  const rank = new Map(plan.orderedPlateIds.map((id, index) => [id, index]));
  return [...jobs].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function chooseFilamentForColor<T extends { id: string; color: string; active: boolean }>(filaments: T[], color: string) {
  const requested = color.trim().toLowerCase();
  return filaments.find((item) => item.active && item.color.trim().toLowerCase() === requested)
    ?? filaments.find((item) => item.active && item.color.trim().toLowerCase().includes(requested))
    ?? filaments.find((item) => item.active);
}
