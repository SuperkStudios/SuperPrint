import { notFound, redirect } from "next/navigation";
import { StoreProductCheckout } from "@/components/store-product-checkout";
import { PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { calculateProductPriceOptions } from "@/services/pricing";
import { getRewardsSettings } from "@/services/rewards";

export const dynamic = "force-dynamic";

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const { slug } = await params;
  const [product, session, rewardsSettings] = await Promise.all([
    prisma.product.findFirst({ where: { slug, status: "ACTIVE" }, include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } }, parts: { orderBy: { displayOrder: "asc" } } } }),
    getCurrentSession().catch(() => null),
    getRewardsSettings()
  ]);
  if (!product) notFound();
  const savedUser = session?.user.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  const fixedProductPriceCents = product.fixedPriceCents ?? product.priceCents;

  const quotes = await calculateProductPriceOptions(product.id);
  const quoteByFilament = new Map(quotes.map((quote) => [quote.filamentMaterialId, quote]));
  const materials = product.allowedFilaments.map((allowed) => {
    const quote = quoteByFilament.get(allowed.filamentMaterialId);
    return {
      id: allowed.filamentMaterial.id,
      material: allowed.filamentMaterial.material,
      color: allowed.filamentMaterial.color,
      brand: allowed.filamentMaterial.brand,
      remainingGrams: allowed.filamentMaterial.remainingGrams,
      requiresAdminApproval: allowed.filamentMaterial.requiresAdminApproval,
      estimatedPrintMinutes: quote?.estimatedPrintMinutes ?? product.estimatedPrintMinutes,
      finalCustomerPriceCents: quote?.finalCustomerPriceCents ?? fixedProductPriceCents,
      unavailableReason: quote?.unavailableReason ?? null,
      marginWarning: quote?.marginWarning ?? null
    };
  });

  return (
    <PageShell>
      <PageSection>
        <StoreProductCheckout
          signedIn={Boolean(session?.user.id)}
          materials={materials}
          publicRewardsSettings={rewardsSettings}
          savedShippingAddress={savedUser ? {
            name: savedUser.shippingName ?? savedUser.name,
            street1: savedUser.shippingStreet1,
            street2: savedUser.shippingStreet2,
            city: savedUser.shippingCity,
            state: savedUser.shippingState,
            zip: savedUser.shippingZip,
            country: savedUser.shippingCountry,
            phone: savedUser.shippingPhone,
            email: savedUser.email
          } : null}
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            modelUrl: product.previewPlateStorageKey || (product.productFileStorageKey && /\.(stl|3mf)$/i.test(product.productFileStorageKey)) ? `/api/products/${product.id}/model` : null,
            modelFormat: product.previewPlateStorageKey && /\.3mf$/i.test(product.previewPlateStorageKey) ? "3mf" : product.productFileStorageKey && /\.3mf$/i.test(product.productFileStorageKey) ? "3mf" : "stl",
            priceCents: fixedProductPriceCents,
            estimatedPrintMinutes: product.estimatedPrintMinutes,
            estimatedGrams: product.estimatedGrams,
            defaultMaterial: product.defaultMaterial,
            colorSlotCount: product.colorSlotCount,
            parts: product.parts.map((part) => ({
              id: part.id,
              name: part.name,
              quantityPerUnit: part.quantityPerUnit,
              colorSlotIndex: part.colorSlotIndex,
              colorSlotPattern: part.colorSlotPattern,
              modelFormat: /\.3mf$/i.test(part.fileStorageKey) ? "3mf" as const : "stl" as const
            }))
          }}
        />
      </PageSection>
    </PageShell>
  );
}
