import { z } from "zod";
import { getPrintMaterialProfile } from "./print-materials";

export const productInputSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  description: z.string().trim().min(1),
  imageUrl: z
    .string()
    .trim()
    .refine((value) => value === "__LOCAL_IMAGE__" || value.startsWith("/api/products/"), "Product images must be uploaded locally"),
  imageStorageKey: z.string().trim().optional(),
  productFileStorageKey: z.string().trim().optional(),
  previewPlateStorageKey: z.string().trim().optional().nullable(),
  priceCents: z.number().int().positive(),
  pricingMode: z.enum(["FIXED", "DYNAMIC"]).default("DYNAMIC"),
  fixedPriceCents: z.number().int().positive().optional().nullable(),
  baseLaborMinutes: z.number().int().nonnegative().default(10),
  basePackagingCents: z.number().int().nonnegative().default(150),
  shippingPackagePreset: z.string().trim().min(1).default("polymailer_4x8"),
  shippingParcelTemplateId: z.string().trim().optional().nullable(),
  shippingPackageLengthIn: z.number().positive().default(8),
  shippingPackageWidthIn: z.number().positive().default(4),
  shippingPackageHeightIn: z.number().positive().default(1),
  shippingPackageWeightOz: z.number().positive().default(8),
  estimatedPrintMinutes: z.number().int().positive(),
  estimatedGrams: z.number().int().positive(),
  materialCostCents: z.number().int().nonnegative().optional(),
  defaultMaterial: z.enum(["PLA", "PLA_PLUS", "PETG", "ABS", "ASA", "TPU", "NYLON", "RESIN", "CARBON_FIBER_PETG"]),
  defaultFilamentMaterialId: z.string().optional().nullable(),
  colorSlotCount: z.number().int().min(1).max(6).default(1),
  maxBatchQuantity: z.number().int().min(1).max(200).default(1),
  parts: z.array(z.object({
    name: z.string().trim().min(1),
    fileStorageKey: z.string().trim().min(1),
    role: z.string().trim().min(1).default("part"),
    colorSlotIndex: z.number().int().min(0).max(5).default(0),
    colorSlotPattern: z.array(z.number().int().min(0).max(5)).max(100).default([]),
    quantityPerUnit: z.number().int().min(1).max(100).default(1),
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

export type ProductInput = z.input<typeof productInputSchema>;

export function normalizeProductInput(input: ProductInput) {
  const product = productInputSchema.parse(input);
  return {
    ...product,
    slug: product.slug ? slugify(product.slug) : slugify(product.name),
    fixedPriceCents: product.pricingMode === "FIXED" ? product.fixedPriceCents ?? product.priceCents : product.fixedPriceCents
  };
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function calculateProductMaterialCostCents(input: {
  estimatedGrams: number;
  rollCostCents: number;
  rollGrams?: number;
}) {
  const rollGrams = input.rollGrams ?? 1000;
  if (input.estimatedGrams <= 0 || input.rollCostCents <= 0 || rollGrams <= 0) return 0;
  return Math.round((input.estimatedGrams / rollGrams) * input.rollCostCents);
}

export function parseProductPrintFileEstimates(text: string, material = "PLA") {
  const grams = parseGcodeGrams(text, material);
  const minutes = parseGcodeMinutes(text);
  return {
    estimatedPrintMinutes: minutes,
    estimatedGrams: grams == null ? null : Math.max(1, Math.round(grams))
  };
}

export function estimateStlPrintFile(data: Uint8Array | ArrayBuffer, material = "PLA") {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const stats = readStlMeshStats(bytes);
  if (!stats || !stats.triangleCount) return { estimatedPrintMinutes: null, estimatedGrams: null };

  const volumeMm3 = Math.abs(stats.signedVolumeMm3);
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) return { estimatedPrintMinutes: null, estimatedGrams: null };

  const profile = getPrintMaterialProfile(material);
  const wallShellMm = profile.lineWidthMm * profile.wallLoops * 0.44;
  const topBottomShellMm = profile.layerHeightMm * profile.topBottomLayers * 0.18;
  const shellThicknessMm = wallShellMm + topBottomShellMm;
  const extrudedVolumeMm3 = ((stats.surfaceAreaMm2 * shellThicknessMm) + (volumeMm3 * profile.infillDensity)) * profile.flowRatio * (1 + profile.supportWasteRatio);
  const estimatedGrams = Math.max(1, Math.round((extrudedVolumeMm3 / 1000) * profile.densityGPerCm3));
  const heightMm = Number.isFinite(stats.minZ) && Number.isFinite(stats.maxZ) ? Math.max(0, stats.maxZ - stats.minZ) : 0;
  const estimatedPrintMinutes = Math.max(3, Math.round(((estimatedGrams * 4.8) + (heightMm * 0.22)) / profile.speedFactor));

  return { estimatedPrintMinutes, estimatedGrams };
}

function parseGcodeGrams(text: string, material: string) {
  const direct = text.match(/;\s*(?:total\s+)?filament used \[g\]\s*[=:]\s*([0-9.]+)/i);
  if (direct && Number(direct[1]) > 0) return Number(direct[1]);
  const orca = text.match(/filament used \[g\]:\s*([0-9.]+)/i);
  if (orca && Number(orca[1]) > 0) return Number(orca[1]);
  const volume = text.match(/;\s*filament used \[cm3\]\s*[=:]\s*([0-9.]+)/i);
  return volume ? Number(volume[1]) * getPrintMaterialProfile(material).densityGPerCm3 : null;
}

function parseGcodeMinutes(text: string) {
  const line =
    text.match(/;\s*estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i) ??
    text.match(/estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i);
  if (!line) return null;
  const value = line[1].trim();
  const days = Number(value.match(/(\d+(?:\.\d+)?)\s*d/i)?.[1] ?? 0);
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.max(1, Math.round(total)) : null;
}

type Vertex = [number, number, number];

type MeshStats = {
  triangleCount: number;
  signedVolumeMm3: number;
  surfaceAreaMm2: number;
  minZ: number;
  maxZ: number;
};

function readStlMeshStats(bytes: Uint8Array): MeshStats | null {
  return readBinaryStlMeshStats(bytes) ?? readAsciiStlMeshStats(new TextDecoder().decode(bytes));
}

function readBinaryStlMeshStats(bytes: Uint8Array): MeshStats | null {
  if (bytes.byteLength < 84) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  if (84 + triangleCount * 50 !== bytes.byteLength) return null;

  const stats = createMeshStats();
  for (let index = 0; index < triangleCount; index += 1) {
    const offset = 84 + index * 50 + 12;
    addTriangleStats(stats,
      readVertex(view, offset),
      readVertex(view, offset + 12),
      readVertex(view, offset + 24)
    );
  }
  return stats;
}

function readAsciiStlMeshStats(text: string): MeshStats {
  const stats = createMeshStats();
  const vertexRegex = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  let first: Vertex | null = null;
  let second: Vertex | null = null;
  let vertexIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = vertexRegex.exec(text))) {
    const vertex: Vertex = [Number(match[1]), Number(match[2]), Number(match[3])];
    const position = vertexIndex % 3;
    if (position === 0) {
      first = vertex;
    } else if (position === 1) {
      second = vertex;
    } else if (first && second) {
      addTriangleStats(stats, first, second, vertex);
      first = null;
      second = null;
    }
    vertexIndex += 1;
  }
  return stats;
}

function readVertex(view: DataView, offset: number): Vertex {
  return [
    view.getFloat32(offset, true),
    view.getFloat32(offset + 4, true),
    view.getFloat32(offset + 8, true)
  ];
}

function signedTetrahedronVolume(a: Vertex, b: Vertex, c: Vertex) {
  return dot(a, cross(b, c)) / 6;
}

function createMeshStats(): MeshStats {
  return {
    triangleCount: 0,
    signedVolumeMm3: 0,
    surfaceAreaMm2: 0,
    minZ: Infinity,
    maxZ: -Infinity
  };
}

function addTriangleStats(stats: MeshStats, a: Vertex, b: Vertex, c: Vertex) {
  stats.triangleCount += 1;
  stats.signedVolumeMm3 += signedTetrahedronVolume(a, b, c);
  stats.surfaceAreaMm2 += triangleArea(a, b, c);
  stats.minZ = Math.min(stats.minZ, a[2], b[2], c[2]);
  stats.maxZ = Math.max(stats.maxZ, a[2], b[2], c[2]);
}

function triangleArea(a: Vertex, b: Vertex, c: Vertex) {
  const ab: Vertex = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vertex = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const area = cross(ab, ac);
  return Math.sqrt(dot(area, area)) / 2;
}

function dot(a: Vertex, b: Vertex) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vertex, b: Vertex): Vertex {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
