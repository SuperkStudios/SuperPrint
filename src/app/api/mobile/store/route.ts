import { NextResponse } from "next/server";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { calculateProductPrice } from "@/services/pricing";

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      allowedFilaments: {
        where: { enabled: true },
        include: { filamentMaterial: true }
      },
      parts: { orderBy: { displayOrder: "asc" } }
    },
    orderBy: { createdAt: "asc" }
  });
  const serialized = await Promise.all(products.map(async (product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    estimatedPrintMinutes: product.estimatedPrintMinutes,
    estimatedGrams: product.estimatedGrams,
    defaultMaterial: product.defaultMaterial,
    colorSlotCount: product.colorSlotCount,
    maxBatchQuantity: product.maxBatchQuantity,
    materials: await Promise.all(product.allowedFilaments.map(async (allowed) => {
      const quote = await calculateProductPrice({
        productId: product.id,
        filamentMaterialId: allowed.filamentMaterialId,
        quantity: 1,
        shippingRequired: false
      });
      return {
        id: allowed.filamentMaterialId,
        material: allowed.filamentMaterial.material,
        color: allowed.filamentMaterial.color,
        brand: allowed.filamentMaterial.brand,
        remainingGrams: allowed.filamentMaterial.remainingGrams,
        requiresAdminApproval: allowed.filamentMaterial.requiresAdminApproval,
        estimatedPrintMinutes: quote.estimatedPrintMinutes,
        finalCustomerPriceCents: quote.finalCustomerPriceCents,
        unavailableReason: quote.unavailableReason,
        marginWarning: quote.marginWarning
      };
    })),
    parts: product.parts.map((part) => ({
      id: part.id,
      name: part.name,
      quantityPerUnit: part.quantityPerUnit,
      colorSlotIndex: part.colorSlotIndex,
      colorSlotPattern: part.colorSlotPattern
    }))
  })));
  return NextResponse.json({ products: serialized });
}
