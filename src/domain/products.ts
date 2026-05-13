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

function parseGcodeGrams(text: string) {
  const direct = text.match(/;\s*(?:total\s+)?filament used \[g\]\s*[=:]\s*([0-9.]+)/i);
  if (direct) return Number(direct[1]);
  const orca = text.match(/filament used \[g\]:\s*([0-9.]+)/i);
  return orca ? Number(orca[1]) : null;
}

function parseGcodeMinutes(text: string) {
  const line = text.match(/;\s*estimated printing time\s*[:=]\s*([^\n\r]+)/i) ?? text.match(/estimated printing time:\s*([^\n\r]+)/i);
  if (!line) return null;
  const value = line[1].trim();
  const days = Number(value.match(/(\d+(?:\.\d+)?)\s*d/i)?.[1] ?? 0);
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.max(1, Math.round(total)) : null;
}
