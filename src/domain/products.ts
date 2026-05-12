import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  description: z.string().trim().min(10),
  imageUrl: z.string().trim().url(),
  priceCents: z.number().int().positive(),
  estimatedPrintMinutes: z.number().int().positive(),
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
