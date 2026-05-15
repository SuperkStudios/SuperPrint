import { Prisma } from "@prisma/client";
import { normalizeProductInput, type ProductInput } from "@/domain/products";
import { prisma } from "@/lib/prisma";

export async function upsertProduct(input: ProductInput & { id?: string }, actorId: string) {
  const product = normalizeProductInput(input);
  const { allowedFilaments, ...productData } = product;
  const saved = input.id
    ? await prisma.product.update({
        where: { id: input.id },
        data: productData as Prisma.ProductUpdateInput
      })
    : await prisma.product.create({
        data: productData as Prisma.ProductCreateInput
      });
  await replaceAllowedFilaments(saved.id, allowedFilaments.length ? allowedFilaments : fallbackAllowedFilament(product.defaultFilamentMaterialId));
  const finalProduct =
    saved.imageUrl === "__LOCAL_IMAGE__"
      ? await prisma.product.update({
          where: { id: saved.id },
          data: { imageUrl: `/api/products/${saved.id}/image` }
        })
      : saved;

  void actorId;

  return finalProduct;
}

async function replaceAllowedFilaments(productId: string, allowedFilaments: ProductInput["allowedFilaments"]) {
  if (!allowedFilaments.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.productAllowedFilament.deleteMany({ where: { productId } });
    await tx.productAllowedFilament.createMany({
      data: allowedFilaments.map((filament) => ({
        productId,
        filamentMaterialId: filament.filamentMaterialId,
        estimatedGramsOverride: filament.estimatedGramsOverride ?? null,
        estimatedPrintMinutesOverride: filament.estimatedPrintMinutesOverride ?? null,
        priceAdjustmentCents: filament.priceAdjustmentCents ?? 0,
        enabled: filament.enabled ?? true
      })),
      skipDuplicates: true
    });
  });
}

function fallbackAllowedFilament(defaultFilamentMaterialId?: string | null): ProductInput["allowedFilaments"] {
  return defaultFilamentMaterialId
    ? [{ filamentMaterialId: defaultFilamentMaterialId, priceAdjustmentCents: 0, enabled: true }]
    : [];
}
