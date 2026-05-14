import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  description: z.string().trim().min(10),
  imageUrl: z
    .string()
    .trim()
    .refine((value) => value === "__LOCAL_IMAGE__" || value.startsWith("/api/products/"), "Product images must be uploaded locally"),
  imageStorageKey: z.string().trim().optional(),
  productFileStorageKey: z.string().trim().optional(),
  priceCents: z.number().int().positive(),
  estimatedPrintMinutes: z.number().int().positive(),
  estimatedGrams: z.number().int().positive(),
  materialCostCents: z.number().int().nonnegative().optional(),
  defaultMaterial: z.enum(["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE")
});

export type ProductInput = z.infer<typeof productInputSchema>;

export function normalizeProductInput(input: ProductInput) {
  const product = productInputSchema.parse(input);
  return {
    ...product,
    slug: product.slug ? slugify(product.slug) : slugify(product.name)
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

export function parseProductPrintFileEstimates(text: string) {
  const grams = parseGcodeGrams(text);
  const minutes = parseGcodeMinutes(text);
  return {
    estimatedPrintMinutes: minutes,
    estimatedGrams: grams == null ? null : Math.max(1, Math.round(grams))
  };
}

export function estimateStlPrintFile(data: Uint8Array | ArrayBuffer, material = "PLA") {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const triangles = readStlTriangles(bytes);
  if (!triangles.length) return { estimatedPrintMinutes: null, estimatedGrams: null };

  const stats = meshStats(triangles);
  const volumeMm3 = stats.volumeMm3;
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) return { estimatedPrintMinutes: null, estimatedGrams: null };

  const density = materialDensities[String(material).toUpperCase()] ?? materialDensities.PLA;
  const shellThicknessMm = 0.55;
  const effectiveInfillRatio = 0.12;
  const extrudedVolumeMm3 = (stats.surfaceAreaMm2 * shellThicknessMm) + (volumeMm3 * effectiveInfillRatio);
  const estimatedGrams = Math.max(1, Math.round((extrudedVolumeMm3 / 1000) * density));
  const estimatedPrintMinutes = Math.max(3, Math.round(estimatedGrams * 4.8 + stats.heightMm * 0.22));

  return { estimatedPrintMinutes, estimatedGrams };
}

const materialDensities: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  NYLON: 1.14,
  RESIN: 1.1
};

function parseGcodeGrams(text: string) {
  const direct = text.match(/;\s*(?:total\s+)?filament used \[g\]\s*[=:]\s*([0-9.]+)/i);
  if (direct && Number(direct[1]) > 0) return Number(direct[1]);
  const orca = text.match(/filament used \[g\]:\s*([0-9.]+)/i);
  if (orca && Number(orca[1]) > 0) return Number(orca[1]);
  const volume = text.match(/;\s*filament used \[cm3\]\s*[=:]\s*([0-9.]+)/i);
  return volume ? Number(volume[1]) * materialDensities.PLA : null;
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
type Triangle = [Vertex, Vertex, Vertex];

function readStlTriangles(bytes: Uint8Array): Triangle[] {
  const binary = readBinaryStlTriangles(bytes);
  if (binary) return binary;
  return readAsciiStlTriangles(new TextDecoder().decode(bytes));
}

function readBinaryStlTriangles(bytes: Uint8Array): Triangle[] | null {
  if (bytes.byteLength < 84) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  if (84 + triangleCount * 50 !== bytes.byteLength) return null;

  const triangles: Triangle[] = [];
  for (let index = 0; index < triangleCount; index += 1) {
    const offset = 84 + index * 50 + 12;
    triangles.push([
      readVertex(view, offset),
      readVertex(view, offset + 12),
      readVertex(view, offset + 24)
    ]);
  }
  return triangles;
}

function readAsciiStlTriangles(text: string): Triangle[] {
  const values = [...text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ] as Vertex);
  const triangles: Triangle[] = [];
  for (let index = 0; index + 2 < values.length; index += 3) {
    triangles.push([values[index], values[index + 1], values[index + 2]]);
  }
  return triangles;
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

function meshStats(triangles: Triangle[]) {
  let signedVolumeMm3 = 0;
  let surfaceAreaMm2 = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [a, b, c] of triangles) {
    signedVolumeMm3 += signedTetrahedronVolume(a, b, c);
    surfaceAreaMm2 += triangleArea(a, b, c);
    minZ = Math.min(minZ, a[2], b[2], c[2]);
    maxZ = Math.max(maxZ, a[2], b[2], c[2]);
  }

  return {
    volumeMm3: Math.abs(signedVolumeMm3),
    surfaceAreaMm2,
    heightMm: Number.isFinite(minZ) && Number.isFinite(maxZ) ? Math.max(0, maxZ - minZ) : 0
  };
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
