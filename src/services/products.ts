import { Prisma } from "@prisma/client";
import { normalizeProductInput, type ProductInput } from "@/domain/products";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "./events";

export async function upsertProduct(input: ProductInput & { id?: string }, actorId: string) {
  const product = normalizeProductInput(input);
  const saved = input.id
    ? await prisma.product.update({
        where: { id: input.id },
        data: product as Prisma.ProductUpdateInput
      })
    : await prisma.product.create({
        data: product as Prisma.ProductCreateInput
      });
  const finalProduct =
    saved.imageUrl === "__LOCAL_IMAGE__"
      ? await prisma.product.update({
          where: { id: saved.id },
          data: { imageUrl: `/api/products/${saved.id}/image` }
        })
      : saved;

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId,
    payload: {
      adminAction: input.id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      productId: finalProduct.id,
      productName: finalProduct.name
    }
  });

  return finalProduct;
}
