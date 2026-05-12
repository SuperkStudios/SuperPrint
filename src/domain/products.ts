import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  description: z.string().trim().min(10),
  imageUrl: z
    .string()
    .trim()
    .refine((value) => value === "__LOCAL_IMAGE__" || value.startsWith("/api/products/") || /^https?:\/\//.test(value), "Invalid product image"),
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
