import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { hasUsableSlicerEstimate, planProductionPlateOrder } from "@/domain/production-loop";
import { getPartProductionPlanner, type PlannerRow } from "./part-planner";
import { authenticateSuperNode } from "./supernode-jobs";

const activePlateStatuses = ["PLANNED", "SLICING", "READY", "NEEDS_FILAMENT", "PRINTING"] as const;

export async function rebuildProductionPlateJobs(actorId?: string) {
  const planner = await getPartProductionPlanner();
  await prisma.productionPlateJob.updateMany({
    where: { status: { in: [...activePlateStatuses] } },
    data: { status: "CANCELED", lastError: "Rebuilt from current paid order demand." }
  });

  const jobs = [];
  for (const group of groupPlannerRowsByProductColor(planner.filter((item) => item.quantityToPrint > 0))) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: group.productId },
      include: {
        parts: { orderBy: { displayOrder: "asc" } },
        allowedFilaments: { include: { filamentMaterial: true } }
      }
    });
    const platePart = product.parts.find((part) => group.rows.some((row) => row.partId === part.id)) ?? product.parts[0];
    if (!platePart) continue;
    const filament = chooseFilamentForColor(product.allowedFilaments.map((item) => item.filamentMaterial), group.color);
    const maxPerPlate = Math.max(1, product.maxBatchQuantity);
    const productsToPrint = Math.max(...group.rows.map((row) => Math.ceil(row.quantityToPrint / Math.max(1, row.quantityPerProductColor))));
    const plateCount = Math.ceil(productsToPrint / maxPerPlate);
    const remainingOrders = group.orders.map((order) => ({ ...order }));
    for (let index = 0; index < plateCount; index += 1) {
      const quantityPlanned = Math.min(maxPerPlate, productsToPrint - index * maxPerPlate);
      const orderRefs = takeOrderRefsForPlate(remainingOrders, quantityPlanned);
      const partManifest = group.rows.map((row) => {
        const quantityPerProduct = Math.max(1, row.quantityPerProductColor);
        return {
          productPartId: row.partId,
          partName: row.partName,
          color: row.color,
          quantityPerProduct,
          quantityPlanned: Math.min(quantityPlanned * quantityPerProduct, Math.max(0, row.quantityToPrint - index * maxPerPlate * quantityPerProduct))
        };
      }).filter((part) => part.quantityPlanned > 0);
      const inputStorageKey = await buildProductionPlateInput({
        product,
        color: group.color,
        plateIndex: index + 1,
        partManifest
      }) ?? platePart.fileStorageKey;
      jobs.push(await prisma.productionPlateJob.create({
        data: {
          productPartId: platePart.id,
          filamentId: filament?.id,
          color: group.color,
          status: "PLANNED",
          quantityPlanned,
          requiredQuantity: group.rows.reduce((total, row) => total + row.requiredQuantity, 0),
          inventoryUsedQuantity: group.rows.reduce((total, row) => total + row.quantityOnHand, 0),
          maxPerPlate,
          plateIndex: index + 1,
          plateCount,
          orderRefs: orderRefs as unknown as Prisma.InputJsonValue,
          partManifest: partManifest as unknown as Prisma.InputJsonValue,
          inputStorageKey
        }
      }));
    }
  }

  void actorId;
  return jobs;
}

function groupPlannerRowsByProductColor(rows: PlannerRow[]) {
  const groups = new Map<string, {
    productId: string;
    productName: string;
    color: string;
    rows: PlannerRow[];
    orders: Array<{ orderNumber: string; quantity: number; customerEmail: string }>;
  }>();
  for (const row of rows) {
    const key = `${row.productId}:${row.color.trim().toLowerCase()}`;
    const group = groups.get(key) ?? {
      productId: row.productId,
      productName: row.productName,
      color: row.color,
      rows: [],
      orders: []
    };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    orders: summarizeGroupOrders(group.rows)
  }));
}

function summarizeGroupOrders(rows: PlannerRow[]) {
  const totalsByPart = rows.map((row) => {
    const totals = new Map<string, { orderNumber: string; quantity: number; customerEmail: string }>();
    for (const order of row.orders) {
      const existing = totals.get(order.orderNumber);
      if (existing) {
        existing.quantity += order.quantity;
      } else {
        totals.set(order.orderNumber, { ...order });
      }
    }
    return totals;
  });
  const orderNumbers = new Set(totalsByPart.flatMap((totals) => [...totals.keys()]));
  return [...orderNumbers].map((orderNumber) => {
    const matches = totalsByPart.map((totals) => totals.get(orderNumber)).filter((item): item is { orderNumber: string; quantity: number; customerEmail: string } => Boolean(item));
    return {
      orderNumber,
      quantity: Math.max(...matches.map((order) => order.quantity)),
      customerEmail: matches[0]?.customerEmail ?? ""
    };
  });
}

function takeOrderRefsForPlate(orders: Array<{ orderNumber: string; quantity: number; customerEmail: string }>, plateQuantity: number) {
  let remaining = plateQuantity;
  const refs: Array<{ orderNumber: string; quantity: number; customerEmail: string }> = [];
  for (const order of orders) {
    if (remaining <= 0) break;
    if (order.quantity <= 0) continue;
    const quantity = Math.min(order.quantity, remaining);
    refs.push({ orderNumber: order.orderNumber, quantity, customerEmail: order.customerEmail });
    order.quantity -= quantity;
    remaining -= quantity;
  }
  return refs;
}

async function buildProductionPlateInput(input: {
  product: {
    name: string;
    previewPlateStorageKey: string | null;
    parts: Array<{ id: string; name: string }>;
  };
  color: string;
  plateIndex: number;
  partManifest: Array<{ productPartId: string; partName: string; quantityPlanned: number }>;
}) {
  if (!input.product.previewPlateStorageKey || input.partManifest.length <= 1) return null;
  const sourcePath = resolveLocalStoragePath(input.product.previewPlateStorageKey);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "superprint-plate-"));
  try {
    await run("unzip", ["-q", sourcePath, "-d", tmpDir]);
    const modelPath = path.join(tmpDir, "3D", "3dmodel.model");
    const model = await readFile(modelPath, "utf8");
    const reduced = reduceBuildItemsForManifest(model, input.partManifest);
    await writeFile(modelPath, reduced.model);
    await filterModelSettings(tmpDir, reduced.objectIds);

    const fileName = `${slugify(input.product.name)}-${slugify(input.color)}-plate-${input.plateIndex}-${randomUUID()}.3mf`;
    const storageKey = buildLocalStorageKey("uploads", `generated-production-plates/${fileName}`);
    const outputPath = resolveLocalStoragePath(storageKey);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await run("zip", ["-qr", outputPath, "."], { cwd: tmpDir });
    return storageKey;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function reduceBuildItemsForManifest(model: string, manifest: Array<{ partName: string; quantityPlanned: number }>) {
  const objectKinds = new Map<string, string>();
  for (const match of model.matchAll(/<object\b[^>]*id="([^"]+)"[\s\S]*?<\/object>/g)) {
    const objectId = match[1];
    const block = match[0].toLowerCase();
    const manifestPart = manifest.find((part) => partNameMatchesObject(part.partName, block));
    if (manifestPart) objectKinds.set(objectId, manifestPart.partName);
  }

  const usedByPart = new Map<string, number>();
  const selectedItems: string[] = [];
  const selectedObjectIds: string[] = [];
  for (const match of model.matchAll(/<item\b[^>]*objectid="([^"]+)"[^>]*\/>/g)) {
    const objectId = match[1];
    const partName = objectKinds.get(objectId);
    if (!partName) continue;
    const required = manifest.find((part) => part.partName === partName)?.quantityPlanned ?? 0;
    const used = usedByPart.get(partName) ?? 0;
    if (used >= required) continue;
    selectedItems.push(`  ${match[0].trim()}`);
    selectedObjectIds.push(objectId);
    usedByPart.set(partName, used + 1);
  }

  if (!selectedItems.length) return { model, objectIds: [] };
  return {
    model: model.replace(/<build\b([^>]*)>[\s\S]*?<\/build>/, `<build$1>\n${selectedItems.join("\n")}\n </build>`),
    objectIds: selectedObjectIds
  };
}

async function filterModelSettings(tmpDir: string, objectIds: string[]) {
  if (!objectIds.length) return;
  const settingsPath = path.join(tmpDir, "Metadata", "model_settings.config");
  const selected = new Set(objectIds);
  try {
    const settings = await readFile(settingsPath, "utf8");
    const objects = [...settings.matchAll(/<object\b[^>]*id="([^"]+)"[\s\S]*?<\/object>/g)]
      .filter((match) => selected.has(match[1]))
      .map((match) => match[0]);
    if (!objects.length) return;
    await writeFile(settingsPath, settings.replace(/<config>[\s\S]*<\/config>/, `<config>\n  ${objects.join("\n  ")}\n</config>`));
  } catch {
    // Some 3MFs do not carry slicer model settings; the core model is still valid.
  }
}

function partNameMatchesObject(partName: string, objectBlock: string) {
  return partName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["part", "nautilus"].includes(token))
    .some((token) => objectBlock.includes(token));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plate";
}

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, { cwd: options.cwd }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve();
    });
  });
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
  const node = await prisma.superNode.findUnique({
    where: { nodeId },
    include: { printer: { include: { currentFilament: true } } }
  });
  await prisma.productionPlateJob.updateMany({
    where: { status: "SLICING", updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
    data: { status: "PLANNED", lastError: "Slicing timed out on SuperNode; retrying." }
  });
  const jobs = await prisma.productionPlateJob.findMany({
    where: { status: "PLANNED" },
    include: { productPart: { include: { product: true } }, filament: true },
    orderBy: [{ createdAt: "asc" }]
  });
  const planned = orderProductionPlateJobs(jobs, node?.printer?.currentFilament).slice(0, 1);
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
    quantity: Array.isArray(job.partManifest) && job.partManifest.length > 1 ? 1 : job.quantityPlanned,
    maxPerPlate: job.maxPerPlate,
    fileName: path.basename(job.inputStorageKey),
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
    fileName: path.basename(job.inputStorageKey),
    file: await readFile(resolveLocalStoragePath(job.inputStorageKey))
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
