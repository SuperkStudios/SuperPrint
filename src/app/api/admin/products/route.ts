import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { upsertProduct } from "@/services/products";
import { calculateProductMaterialCostCents } from "@/domain/products";
import { shippingPackagePresetById } from "@/domain/shipping-packages";
import { estimatePrintFile } from "@/services/slicer-estimates";

const schema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string(),
  imageUrl: z.string().optional(),
  imageStorageKey: z.string().optional(),
  productFileStorageKey: z.string().optional(),
  previewPlateStorageKey: z.string().optional().nullable(),
  priceCents: z.number(),
  pricingMode: z.enum(["FIXED", "DYNAMIC"]).default("FIXED"),
  fixedPriceCents: z.number().optional().nullable(),
  baseLaborMinutes: z.number().int().nonnegative().default(10),
  basePackagingCents: z.number().int().nonnegative().default(150),
  shippingPackagePreset: z.string().default("polymailer_4x8"),
  shippingParcelTemplateId: z.string().optional().nullable(),
  shippingPackageLengthIn: z.number().positive().default(8),
  shippingPackageWidthIn: z.number().positive().default(4),
  shippingPackageHeightIn: z.number().positive().default(1),
  shippingPackageWeightOz: z.number().positive().default(8),
  estimatedPrintMinutes: z.number(),
  estimatedGrams: z.number(),
  materialCostCents: z.number().optional(),
  defaultMaterial: z.enum(["PLA", "PLA_PLUS", "PETG", "ABS", "ASA", "TPU", "NYLON", "RESIN", "CARBON_FIBER_PETG"]),
  defaultFilamentMaterialId: z.string().optional().nullable(),
  colorSlotCount: z.number().int().min(1).max(6).default(1),
  maxBatchQuantity: z.number().int().min(1).max(200).default(1),
  parts: z.array(z.object({
    name: z.string(),
    fileStorageKey: z.string(),
    role: z.string().default("part"),
    colorSlotIndex: z.number().int().min(0).max(5).default(0),
    colorSlotPattern: z.array(z.number().int().min(0).max(5)).max(100).default([]),
    quantityPerUnit: z.number().int().positive().default(1),
    displayOrder: z.number().int().nonnegative().default(0)
  })).default([]),
  allowedFilaments: z.array(z.object({
    filamentMaterialId: z.string(),
    estimatedGramsOverride: z.number().int().positive().optional().nullable(),
    estimatedPrintMinutesOverride: z.number().int().positive().optional().nullable(),
    priceAdjustmentCents: z.number().int().default(0),
    enabled: z.boolean().default(true)
  })).default([]),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE")
});

export async function GET() {
  const { response } = await requireAdmin("products");
  if (response) return response;
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } },
      parts: { orderBy: { displayOrder: "asc" } }
    },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      estimatedPrintMinutes: product.estimatedPrintMinutes,
      estimatedGrams: product.estimatedGrams,
      colorSlotCount: product.colorSlotCount,
      defaultMaterial: product.defaultMaterial,
      status: product.status,
      maxBatchQuantity: product.maxBatchQuantity,
      parts: product.parts.map((part) => ({
        id: part.id,
        name: part.name,
        colorSlotIndex: part.colorSlotIndex,
        colorSlotPattern: part.colorSlotPattern,
        quantityPerUnit: part.quantityPerUnit
      })),
      allowedFilaments: product.allowedFilaments.map((item) => ({
        filamentMaterialId: item.filamentMaterialId,
        estimatedGramsOverride: item.estimatedGramsOverride,
        estimatedPrintMinutesOverride: item.estimatedPrintMinutesOverride,
        filamentMaterial: {
          color: item.filamentMaterial.color,
          material: item.filamentMaterial.material
        }
      }))
    }))
  });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("products");
  if (response) return response;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await readProductRequest(request));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid product input" }, { status: 400 });
  }
  if (body.id && !body.imageStorageKey) {
    const existing = await prisma.product.findUnique({ where: { id: body.id } });
    body.imageUrl = existing?.imageUrl;
    body.imageStorageKey = existing?.imageStorageKey ?? undefined;
    body.productFileStorageKey = body.productFileStorageKey ?? existing?.productFileStorageKey ?? undefined;
    body.previewPlateStorageKey = body.previewPlateStorageKey ?? existing?.previewPlateStorageKey ?? undefined;
  }
  if (!body.imageStorageKey && !body.productFileStorageKey) {
    return NextResponse.json({ error: "Upload a product image or an STL print file" }, { status: 400 });
  }
  body.imageUrl = body.imageUrl ?? "__LOCAL_IMAGE__";
  try {
    return NextResponse.json({ product: await upsertProduct({ ...body, imageUrl: body.imageUrl ?? "__LOCAL_IMAGE__" }, session!.user.id) });
  } catch (error) {
    return NextResponse.json({ error: productErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { response } = await requireAdmin("products");
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product id is required" }, { status: 400 });

  const orderCount = await prisma.order.count({ where: { productId: id } });
  if (orderCount > 0) {
    const product = await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    return NextResponse.json({ product, message: "Product has orders, so it was archived instead of deleted." });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ message: "Product deleted." });
}

async function readProductRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return request.json();

  const formData = await request.formData();
  const imageFile = formData.get("imageFile");
  const printFile = formData.get("printFile");
  const previewPlateFile = formData.get("previewPlateFile");
  const imageStorageKey = imageFile instanceof File && imageFile.size > 0 ? await storeProductFile(imageFile, "thumbnails", ["image/png", "image/jpeg", "image/webp"]) : undefined;
  const defaultFilamentMaterialId = stringValue(formData.get("defaultFilamentMaterialId"));
  const defaultSpool = defaultFilamentMaterialId ? await prisma.filamentSpool.findUnique({ where: { id: defaultFilamentMaterialId } }) : null;
  const material = String(formData.get("defaultMaterial") ?? defaultSpool?.material ?? "PLA");
  const parsedPrintFile = printFile instanceof File && printFile.size > 0 ? await storeProductPrintFile(printFile, material) : undefined;
  const previewPlateStorageKey = previewPlateFile instanceof File && previewPlateFile.size > 0 ? await storeProductPrintFile(previewPlateFile, material).then((file) => file.storageKey) : undefined;
  const estimatedGrams = parsedPrintFile?.estimatedGrams ?? Number(formData.get("estimatedGrams") ?? 0);
  const spool = defaultSpool ?? await prisma.filamentSpool.findFirst({ where: { material: material as never }, orderBy: { rollCostCents: "desc" } });
  const allowedFilaments = parseAllowedFilaments(formData, defaultFilamentMaterialId ?? spool?.id);
  const parts = await parseProductParts(formData);
  const fixedPriceCents = optionalCents(formData.get("fixedPriceCents"));
  const pricingMode = "FIXED";
  const fallbackPriceCents = Number(formData.get("priceCents") ?? 0);
  const preset = shippingPackagePresetById(stringValue(formData.get("shippingPackagePreset")));

  return {
    id: stringValue(formData.get("id")),
    name: String(formData.get("name") ?? ""),
    slug: stringValue(formData.get("slug")),
    description: String(formData.get("description") ?? ""),
    imageUrl: imageStorageKey ? "__LOCAL_IMAGE__" : undefined,
    imageStorageKey,
    productFileStorageKey: parsedPrintFile?.storageKey,
    previewPlateStorageKey,
    priceCents: fixedPriceCents || fallbackPriceCents || 1,
    pricingMode,
    fixedPriceCents,
    baseLaborMinutes: Number(formData.get("baseLaborMinutes") ?? 10),
    basePackagingCents: Number(formData.get("basePackagingCents") ?? 150),
    shippingPackagePreset: stringValue(formData.get("shippingPackagePreset")) ?? preset.id,
    shippingParcelTemplateId: stringValue(formData.get("shippingParcelTemplateId")) ?? null,
    shippingPackageLengthIn: optionalPositiveNumber(formData.get("shippingPackageLengthIn")) ?? preset.lengthIn,
    shippingPackageWidthIn: optionalPositiveNumber(formData.get("shippingPackageWidthIn")) ?? preset.widthIn,
    shippingPackageHeightIn: optionalPositiveNumber(formData.get("shippingPackageHeightIn")) ?? preset.heightIn,
    shippingPackageWeightOz: optionalPositiveNumber(formData.get("shippingPackageWeightOz")) ?? preset.weightOz,
    estimatedPrintMinutes: parsedPrintFile?.estimatedPrintMinutes ?? Number(formData.get("estimatedPrintMinutes") ?? 0),
    estimatedGrams,
    materialCostCents: calculateProductMaterialCostCents({ estimatedGrams, rollCostCents: spool?.rollCostCents ?? 0 }),
    defaultMaterial: material,
    defaultFilamentMaterialId: defaultFilamentMaterialId ?? spool?.id,
    colorSlotCount: Math.min(6, Math.max(1, Math.round(Number(formData.get("colorSlotCount") ?? 1)))),
    maxBatchQuantity: Math.min(200, Math.max(1, Math.round(Number(formData.get("maxBatchQuantity") ?? 1)))),
    parts,
    allowedFilaments,
    status: String(formData.get("status") ?? "ACTIVE")
  };
}

async function parseProductParts(formData: FormData) {
  const existing = safeJsonArray(String(formData.get("existingParts") ?? ""));
  const uploadedMeta = safeJsonArray(String(formData.get("uploadedPartMeta") ?? ""), { requireFileStorageKey: false });
  const uploaded = await Promise.all(formData.getAll("partFiles")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .map(async (file, index) => {
      const stored = await storeProductPrintFile(file, String(formData.get("defaultMaterial") ?? "PLA"));
      const cleanName = file.name.replace(/\.(stl|3mf)$/i, "");
      const meta = uploadedMeta[index];
      return {
        name: meta?.name ?? cleanName,
        fileStorageKey: stored.storageKey,
        role: meta?.role ?? inferPartRole(cleanName),
        colorSlotIndex: meta?.colorSlotIndex ?? inferPartColorSlot(cleanName),
        colorSlotPattern: normalizeColorSlotPattern(meta?.colorSlotPattern, meta?.quantityPerUnit ?? 1, meta?.colorSlotIndex ?? inferPartColorSlot(cleanName)),
        quantityPerUnit: meta?.quantityPerUnit ?? 1,
        displayOrder: meta?.displayOrder ?? existing.length + index
      };
    }));
  return [...existing, ...uploaded];
}

function safeJsonArray(value: string, options: { requireFileStorageKey?: boolean } = {}) {
  if (!value.trim()) return [];
  const requireFileStorageKey = options.requireFileStorageKey ?? true;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item, index) => ({
        name: String(item.name ?? `Part ${index + 1}`),
        fileStorageKey: String(item.fileStorageKey ?? ""),
        role: String(item.role ?? "part"),
        colorSlotIndex: Math.min(5, Math.max(0, Math.round(Number(item.colorSlotIndex ?? 0)))),
        colorSlotPattern: normalizeColorSlotPattern(item.colorSlotPattern, Number(item.quantityPerUnit ?? 1), Number(item.colorSlotIndex ?? 0)),
        quantityPerUnit: Math.max(1, Math.round(Number(item.quantityPerUnit ?? 1))),
        displayOrder: Math.max(0, Math.round(Number(item.displayOrder ?? index)))
      }))
      .filter((item) => !requireFileStorageKey || item.fileStorageKey);
  } catch {
    return [];
  }
}

function normalizeColorSlotPattern(value: unknown, quantity: number, fallbackSlot: number) {
  const safeQuantity = Math.max(1, Math.round(Number(quantity) || 1));
  const safeFallback = Math.min(5, Math.max(0, Math.round(Number(fallbackSlot) || 0)));
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, safeQuantity)
    .map((slot) => Math.min(5, Math.max(0, Math.round(Number(slot) || safeFallback))));
}

function inferPartRole(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("gear")) return "gear";
  if (lower.includes("connector") || lower.includes("bar")) return "connector";
  return "part";
}

function inferPartColorSlot(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("right") || lower.includes("second") || lower.includes("color2")) return 1;
  return 0;
}

function stringValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

function optionalCents(value: FormDataEntryValue | null) {
  const parsed = Math.round(Number(value ?? 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalPositiveInt(value: FormDataEntryValue | null) {
  const parsed = Math.round(Number(value ?? 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalPositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAllowedFilaments(formData: FormData, fallbackId?: string) {
  const ids = formData.getAll("allowedFilamentIds").map(String).filter(Boolean);
  const uniqueIds = [...new Set(ids.length ? ids : fallbackId ? [fallbackId] : [])];
  return uniqueIds.map((id) => ({
    filamentMaterialId: id,
    estimatedGramsOverride: optionalPositiveInt(formData.get(`overrideGrams:${id}`)),
    estimatedPrintMinutesOverride: optionalPositiveInt(formData.get(`overrideMinutes:${id}`)),
    priceAdjustmentCents: Math.round(Number(formData.get(`priceAdjustmentCents:${id}`) ?? 0)),
    enabled: formData.get(`enabled:${id}`) !== "false"
  }));
}

async function storeProductFile(file: File, storageClass: "uploads" | "thumbnails", acceptedTypes: string[]) {
  if (file.name.includes("/") || file.name.includes("\\") || file.name.includes("..")) {
    throw new Error("Unsafe product file name");
  }
  if (!acceptedTypes.includes((file.type ?? "").toLowerCase())) {
    throw new Error("Unsupported product file type");
  }
  if (storageClass === "uploads" && !/\.(stl|gcode|gco|g|3mf)$/i.test(file.name)) {
    throw new Error("Product print file must be STL, G-code, or 3MF");
  }
  if (storageClass === "thumbnails" && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error("Product image must be PNG, JPEG, or WebP");
  }
  const key = buildLocalStorageKey(storageClass, `${createHash("sha256").update(file.name).digest("hex").slice(0, 10)}-${file.name}`);
  const localPath = resolveLocalStoragePath(key);
  await mkdir(localPath.slice(0, localPath.lastIndexOf("/")), { recursive: true });
  await writeFile(localPath, Buffer.from(await file.arrayBuffer()));
  return key;
}

async function storeProductPrintFile(file: File, material: string) {
  const storageKey = await storeProductFile(file, "uploads", ["model/stl", "model/3mf", "application/octet-stream", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", "text/plain", "application/vnd.ms-pki.stl", ""]);
  if (!/\.(stl|gcode|gco|g)$/i.test(file.name)) return { storageKey };
  const bytes = await file.arrayBuffer();
  const estimates = await estimatePrintFile({
    fileName: file.name,
    contentType: file.type,
    material,
    bytes
  });
  return {
    storageKey,
    estimatedGrams: estimates.estimatedGrams ?? undefined,
    estimatedPrintMinutes: estimates.estimatedPrintMinutes ?? undefined
  };
}

function productErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "product"}: ${issue.message}`).join("; ");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A product with that slug already exists.";
  }
  return error instanceof Error ? error.message : "Product save failed.";
}
