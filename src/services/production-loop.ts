import { Prisma } from "@prisma/client";
import { CentauriPrinterControlAdapter, ManualNoopPrinterControlAdapter } from "@/domain/printer-control";
import { filamentLabel, hasUsableSlicerEstimate, planProductionPlateOrder } from "@/domain/production-loop";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";
import { getRecentSuperNodeCameraFrame } from "./supernode-camera-frames";
import { recordPlatformEvent } from "./events";
import { sendMobilePush } from "./mobile-push";
import { getPartProductionPlanner } from "./part-planner";
import { rebuildProductionPlateJobs } from "./production-plates";

type ProductionLoopAction =
  | "startProduction"
  | "confirmFilamentChanged"
  | "runAiPlateCheck"
  | "confirmPlateClear"
  | "sendPlateToPrinter"
  | "markPrintFinished"
  | "markPartsInventoried"
  | "markOrderPacked";

type PlateWithIncludes = Prisma.ProductionPlateJobGetPayload<{
  include: {
    productPart: { include: { product: true } };
    filament: true;
  };
}>;

const activeStatuses = ["PLANNED", "SLICING", "READY", "NEEDS_FILAMENT", "PRINTING", "PRINTED"] as const;

export async function getProductionLoopState() {
  const [printer, plateJobs, planner, openMaintenance] = await Promise.all([
    prisma.printer.findFirst({
      where: { status: { not: "OFFLINE" } },
      include: { currentFilament: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.productionPlateJob.findMany({
      where: { status: { in: [...activeStatuses] } },
      include: { productPart: { include: { product: true } }, filament: true },
      orderBy: [{ createdAt: "asc" }]
    }),
    getPartProductionPlanner(),
    prisma.maintenanceTask.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: { printer: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 5
    })
  ]);

  const ordered = orderLoopPlates(plateJobs, printer?.currentFilament);
  const activePrinting = ordered.find((job) => job.status === "PRINTING");
  const nextPlate = activePrinting ?? ordered.find((job) => job.status !== "PRINTED");
  const readyOrders = await getAssemblyReadyOrders(planner);
  const latestCameraFrame = printer ? getRecentSuperNodeCameraFrame(printer.id) : null;

  return {
    printer: printer
      ? {
          id: printer.id,
          name: printer.publicName,
          modelName: printer.modelName,
          status: printer.status,
          cameraStatus: printer.cameraStatus,
          currentFilament: printer.currentFilament
            ? {
                id: printer.currentFilament.id,
                name: filamentLabel(printer.currentFilament),
                color: printer.currentFilament.color,
                material: printer.currentFilament.material,
                remainingGrams: printer.currentFilament.remainingGrams
              }
            : null
        }
      : null,
    nextAction: buildNextAction({ printer, nextPlate, latestCameraFrame, readyOrders, openMaintenance }),
    nextPlate: nextPlate ? serializePlate(nextPlate) : null,
    batches: summarizeBatches(ordered, printer?.currentFilament),
    readyOrders,
    maintenance: openMaintenance.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      printerName: task.printer.publicName,
      dueAt: task.dueAt.toISOString(),
      status: task.status
    })),
    camera: printer
      ? {
          status: printer.cameraStatus,
          streamUrl: `/api/printer-feed/stream?printerId=${encodeURIComponent(printer.id)}`,
          recentFrameAvailable: Boolean(latestCameraFrame),
          lastFrameAt: latestCameraFrame?.receivedAt.toISOString() ?? null
        }
      : null,
    counts: {
      plates: ordered.length,
      printing: ordered.filter((job) => job.status === "PRINTING").length,
      readyToPrint: ordered.filter((job) => job.status === "READY").length,
      needsSlicing: ordered.filter((job) => !hasUsableSlicerEstimate(job)).length,
      readyOrders: readyOrders.length
    }
  };
}

export async function runProductionLoopAction(input: {
  action: ProductionLoopAction;
  plateJobId?: string;
  orderId?: string;
  actorId?: string;
}) {
  if (input.action === "startProduction") {
    const jobs = await rebuildProductionPlateJobs(input.actorId);
    await recordCheckpoint({ action: input.action, actorId: input.actorId, payload: { rebuiltPlateCount: jobs.length } });
    return { jobs, state: await getProductionLoopState() };
  }

  if (input.action === "markOrderPacked") {
    if (!input.orderId) throw new Error("orderId is required.");
    const order = await prisma.order.update({ where: { id: input.orderId }, data: { shippingStatus: "PACKING" } });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, payload: { orderId: order.id, orderNumber: order.orderNumber } });
    return { order, state: await getProductionLoopState() };
  }

  if (!input.plateJobId) throw new Error("plateJobId is required.");
  const plate = await prisma.productionPlateJob.findUniqueOrThrow({
    where: { id: input.plateJobId },
    include: { productPart: { include: { product: true } }, filament: true }
  });

  if (input.action === "confirmFilamentChanged") {
    const printer = await getPrinterForPlate(plate);
    if (!plate.filamentId) throw new Error("This plate does not have a filament spool assigned.");
    await prisma.$transaction([
      prisma.printer.update({ where: { id: printer.id }, data: { currentFilamentId: plate.filamentId } }),
      prisma.productionPlateJob.update({ where: { id: plate.id }, data: { filamentConfirmedAt: new Date(), status: plate.status === "NEEDS_FILAMENT" ? "READY" : plate.status } })
    ]);
    await recordPlatformEvent({ type: "PRODUCTION_FILAMENT_CHANGE_COMPLETED", actorId: input.actorId, payload: platePayload(plate, printer.id) });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id });
    return { state: await getProductionLoopState() };
  }

  if (input.action === "runAiPlateCheck") {
    const printer = await getPrinterForPlate(plate);
    const result = await runAiBuildPlateCheck(printer.id);
    await prisma.productionPlateJob.update({
      where: { id: plate.id },
      data: {
        aiPlateCheckStatus: result.status,
        aiPlateCheckConfidence: Math.round(result.confidence * 100),
        aiPlateCheckReason: result.reason
      }
    });
    await recordPlatformEvent({
      type: result.status === "clear" ? "PRODUCTION_PLATE_CLEAR_CHECK_PASSED" : "PRODUCTION_PLATE_CLEAR_CHECK_FAILED",
      actorId: input.actorId,
      payload: { ...platePayload(plate, printer.id), aiStatus: result.status, confidence: result.confidence, reason: result.reason }
    });
    if (result.status !== "clear") {
      await sendMobilePush({
        title: "Build plate needs review",
        body: result.reason,
        data: { plateJobId: plate.id, action: "plate_check" }
      });
    }
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id, payload: result });
    return { result, state: await getProductionLoopState() };
  }

  if (input.action === "confirmPlateClear") {
    const printer = await getPrinterForPlate(plate);
    const updated = await prisma.productionPlateJob.update({
      where: { id: plate.id },
      data: { plateClearConfirmedAt: new Date() }
    });
    await recordPlatformEvent({ type: "PRODUCTION_PLATE_CLEAR_CHECK_PASSED", actorId: input.actorId, payload: platePayload(updated as PlateWithIncludes, printer.id) });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id });
    return { state: await getProductionLoopState() };
  }

  if (input.action === "sendPlateToPrinter") {
    const printer = await getPrinterForPlate(plate);
    assertPlateCanStart(plate, printer.currentFilamentId);
    const adapter = process.env.CENTAURI_DIRECT_START_ENABLED === "true"
      ? new CentauriPrinterControlAdapter({ controlApiUrl: printer.controlApiUrl })
      : new ManualNoopPrinterControlAdapter();
    const ack = await adapter.startPrint({
      printJobId: plate.id,
      gcodeLocalPath: resolveLocalStoragePath(plate.outputStorageKey!)
    });
    const updated = await prisma.productionPlateJob.update({
      where: { id: plate.id },
      data: { status: "PRINTING", startedAt: new Date(), lastError: null }
    });
    await recordPlatformEvent({ type: "PRODUCTION_PLATE_PRINT_STARTED", actorId: input.actorId, payload: { ...platePayload(plate, printer.id), ack } });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id, payload: ack });
    return { job: updated, ack, state: await getProductionLoopState() };
  }

  if (input.action === "markPrintFinished") {
    const printer = await getPrinterForPlate(plate);
    const updated = await prisma.productionPlateJob.update({
      where: { id: plate.id },
      data: { status: "PRINTED", printedQuantity: plate.quantityPlanned, completedAt: new Date() }
    });
    await recordPlatformEvent({ type: "PRODUCTION_PLATE_PRINT_COMPLETED", actorId: input.actorId, payload: platePayload(plate, printer.id) });
    await sendMobilePush({
      title: "Print finished",
      body: `${plate.color} ${plate.productPart.name} is ready to remove from the plate.`,
      data: { plateJobId: plate.id, action: "print_finished" }
    });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id });
    return { job: updated, state: await getProductionLoopState() };
  }

  if (input.action === "markPartsInventoried") {
    const printer = await getPrinterForPlate(plate);
    const [inventory, updated] = await prisma.$transaction([
      prisma.productPartInventory.upsert({
        where: {
          productPartId_color_location: {
            productPartId: plate.productPartId,
            color: plate.color,
            location: "Fresh prints"
          }
        },
        update: { quantityOnHand: { increment: plate.quantityPlanned }, notes: `Inventoried from production plate ${plate.plateIndex}/${plate.plateCount}` },
        create: {
          productPartId: plate.productPartId,
          color: plate.color,
          quantityOnHand: plate.quantityPlanned,
          location: "Fresh prints",
          notes: `Inventoried from production plate ${plate.plateIndex}/${plate.plateCount}`
        }
      }),
      prisma.productionPlateJob.update({
        where: { id: plate.id },
        data: { status: "INVENTORIED", inventoriedQuantity: plate.quantityPlanned, completedAt: new Date() }
      })
    ]);
    await recordPlatformEvent({ type: "PRODUCTION_ASSEMBLY_READY", actorId: input.actorId, payload: platePayload(plate, printer.id) });
    await recordCheckpoint({ action: input.action, actorId: input.actorId, plateJobId: plate.id, printerId: printer.id, payload: { inventoryId: inventory.id } });
    return { job: updated, inventory, state: await getProductionLoopState() };
  }

  throw new Error(`Unsupported production action: ${input.action}`);
}

function buildNextAction(input: {
  printer: Awaited<ReturnType<typeof prisma.printer.findFirst<{ include: { currentFilament: true } }>>>;
  nextPlate?: PlateWithIncludes | null;
  latestCameraFrame?: ReturnType<typeof getRecentSuperNodeCameraFrame>;
  readyOrders: Array<{ id: string; orderNumber: string }>;
  openMaintenance: Array<{ id: string; title: string }>;
}) {
  if (input.openMaintenance.length) {
    return {
      type: "maintenance_due",
      title: "Do maintenance first",
      detail: input.openMaintenance[0].title,
      primaryButton: "Open Maintenance"
    };
  }
  if (!input.nextPlate) {
    if (input.readyOrders.length) {
      return {
        type: "assemble_orders",
        title: "Assemble and package ready orders",
        detail: `${input.readyOrders.length} order${input.readyOrders.length === 1 ? "" : "s"} have enough printed parts.`,
        primaryButton: "Start Assembly"
      };
    }
    return { type: "start_production", title: "Start production", detail: "Rebuild plate jobs from paid orders.", primaryButton: "Start Production" };
  }
  if (input.nextPlate.status === "PRINTING") {
    return {
      type: "printing",
      title: "Waiting for printing to finish",
      detail: `${input.nextPlate.productPart.product.name} ${input.nextPlate.color} is printing.`,
      primaryButton: "Print Finished"
    };
  }
  const currentFilamentId = input.printer?.currentFilamentId ?? null;
  if (input.nextPlate.filamentId && currentFilamentId !== input.nextPlate.filamentId && !input.nextPlate.filamentConfirmedAt) {
    return {
      type: "change_filament",
      title: "Change filament",
      detail: `Load ${filamentLabel(input.nextPlate.filament ?? { color: input.nextPlate.color })}.`,
      primaryButton: "Filament Changed"
    };
  }
  if (!hasUsableSlicerEstimate(input.nextPlate)) {
    return {
      type: "needs_slicing",
      title: "Waiting for slicer estimate",
      detail: "The plate needs real Elegoo/Orca slicer time, grams, and G-code before printing.",
      primaryButton: "Refresh"
    };
  }
  if (!input.nextPlate.plateClearConfirmedAt) {
    return {
      type: "confirm_plate_clear",
      title: "Physically check build plate",
      detail: "Look inside the printer. Remove finished parts, scraps, and purge material, then confirm the plate is empty.",
      primaryButton: "Plate Is Clear"
    };
  }
  return {
    type: "send_print",
    title: "Send next plate",
    detail: `${input.nextPlate.quantityPlanned} ${input.nextPlate.color} ${input.nextPlate.productPart.name}, ${input.nextPlate.estimatedPrintMinutes} minutes, ${input.nextPlate.estimatedGrams}g.`,
    primaryButton: "Send Print"
  };
}

function assertPlateCanStart(plate: PlateWithIncludes, currentFilamentId?: string | null) {
  if (!hasUsableSlicerEstimate(plate)) throw new Error("This plate needs a real slicer estimate and G-code before printing.");
  if (plate.filamentId && plate.filamentId !== currentFilamentId && !plate.filamentConfirmedAt) throw new Error("Confirm the correct filament is loaded before printing.");
  if (!plate.plateClearConfirmedAt) throw new Error("Confirm the build plate is clear before printing.");
}

async function getPrinterForPlate(plate: PlateWithIncludes) {
  const printer = await prisma.printer.findFirst({
    where: { status: { not: "OFFLINE" } },
    include: { currentFilament: true },
    orderBy: plate.filamentId ? [{ currentFilamentId: "desc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }]
  });
  if (!printer) throw new Error("No online printer is available.");
  return printer;
}

function orderLoopPlates(jobs: PlateWithIncludes[], currentFilament?: { id: string; material: string; color: string } | null) {
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
  return [...jobs].sort((a, b) => {
    if (a.status === "PRINTING" && b.status !== "PRINTING") return -1;
    if (b.status === "PRINTING" && a.status !== "PRINTING") return 1;
    return (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

function summarizeBatches(jobs: PlateWithIncludes[], currentFilament?: { id: string; material: string; color: string } | null) {
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
  return plan.groups.map((group) => ({
    ...group,
    label: filamentLabel({ color: group.color, material: group.material })
  }));
}

function serializePlate(plate: PlateWithIncludes) {
  const orderRefs = Array.isArray(plate.orderRefs) ? plate.orderRefs : [];
  return {
    id: plate.id,
    status: plate.status,
    productName: plate.productPart.product.name,
    partName: plate.productPart.name,
    color: plate.color,
    quantityPlanned: plate.quantityPlanned,
    plateIndex: plate.plateIndex,
    plateCount: plate.plateCount,
    material: plate.filament?.material ?? plate.productPart.product.defaultMaterial,
    filament: plate.filament ? { id: plate.filament.id, name: filamentLabel(plate.filament), color: plate.filament.color, material: plate.filament.material } : null,
    estimate: hasUsableSlicerEstimate(plate)
      ? { minutes: plate.estimatedPrintMinutes, grams: plate.estimatedGrams, message: plate.slicerMessage }
      : null,
    estimateLabel: hasUsableSlicerEstimate(plate) ? `${plate.estimatedPrintMinutes} min · ${plate.estimatedGrams}g` : "Needs slicing estimate",
    aiPlateCheck: {
      status: plate.aiPlateCheckStatus,
      confidence: plate.aiPlateCheckConfidence,
      reason: plate.aiPlateCheckReason
    },
    filamentConfirmedAt: plate.filamentConfirmedAt?.toISOString() ?? null,
    plateClearConfirmedAt: plate.plateClearConfirmedAt?.toISOString() ?? null,
    orderRefs
  };
}

async function getAssemblyReadyOrders(planner: Awaited<ReturnType<typeof getPartProductionPlanner>>) {
  const readyOrderNumbers = new Set(planner.filter((row) => row.quantityToPrint === 0).flatMap((row) => row.orders.map((order) => order.orderNumber)));
  if (!readyOrderNumbers.size) return [];
  const orders = await prisma.order.findMany({
    where: {
      orderNumber: { in: [...readyOrderNumbers] },
      orderSource: { not: "PAST_IMPORT" },
      shippingStatus: { notIn: ["PACKING", "SHIPPED", "DELIVERED"] }
    },
    include: { customer: true, product: true },
    orderBy: { createdAt: "asc" }
  });
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    productName: order.product?.name ?? "Order",
    customerEmail: order.customer.email,
    fulfillmentMethod: order.fulfillmentMethod,
    shippingStatus: order.shippingStatus
  }));
}

async function runAiBuildPlateCheck(printerId: string) {
  const frame = getRecentSuperNodeCameraFrame(printerId);
  if (!frame) return { status: "unsure" as const, confidence: 0, reason: "No fresh camera frame is available from SuperNode." };
  if (!process.env.OPENAI_API_KEY) return { status: "unsure" as const, confidence: 0, reason: "OPENAI_API_KEY is not configured for AI plate checks." };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PLATE_CHECK_MODEL ?? "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Inspect this 3D printer build plate before starting a print. Return only JSON with status clear, blocked, or unsure; confidence 0-1; and a short reason. clear means the plate is empty and safe to start." },
          { type: "input_image", image_url: `data:${frame.contentType};base64,${Buffer.from(frame.frame).toString("base64")}`, detail: "low" }
        ]
      }]
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return { status: "unsure" as const, confidence: 0, reason: `AI plate check failed with HTTP ${response.status}.` };
  const body = await response.json().catch(() => null) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> } | null;
  const text = body?.output_text ?? body?.output?.flatMap((item) => item.content ?? []).map((item) => item.text).filter(Boolean).join("\n") ?? "";
  const parsed = parseAiPlateCheck(text);
  return parsed ?? { status: "unsure" as const, confidence: 0, reason: "AI plate check returned an unreadable response." };
}

function parseAiPlateCheck(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { status?: string; confidence?: number; reason?: string };
    const status = parsed.status === "clear" || parsed.status === "blocked" || parsed.status === "unsure" ? parsed.status : "unsure";
    return {
      status,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason || "No reason returned.").slice(0, 240)
    };
  } catch {
    return null;
  }
}

function platePayload(plate: PlateWithIncludes | { id: string; color: string; quantityPlanned: number; productPart?: { name?: string; product?: { name?: string } } }, printerId: string) {
  return {
    plateJobId: plate.id,
    printerId,
    productName: plate.productPart?.product?.name,
    partName: plate.productPart?.name,
    color: plate.color,
    quantity: plate.quantityPlanned
  };
}

async function recordCheckpoint(input: {
  action: string;
  actorId?: string;
  plateJobId?: string;
  printerId?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.productionOperatorCheckpoint.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      plateJobId: input.plateJobId,
      printerId: input.printerId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue
    }
  });
}
