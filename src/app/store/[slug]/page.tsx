import { notFound, redirect } from "next/navigation";
import { StoreProductCheckout } from "@/components/store-product-checkout";
import { PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { calculateProductPriceOptions } from "@/services/pricing";

export const dynamic = "force-dynamic";

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const { slug } = await params;
  const [product, session] = await Promise.all([
    prisma.product.findFirst({ where: { slug, status: "ACTIVE" }, include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } } }),
    getCurrentSession().catch(() => null)
  ]);
  if (!product) notFound();

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
      finalCustomerPriceCents: quote?.finalCustomerPriceCents ?? product.priceCents,
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
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            modelUrl: product.productFileStorageKey && /\.stl$/i.test(product.productFileStorageKey) ? `/api/products/${product.id}/model` : null,
            priceCents: product.priceCents,
            estimatedPrintMinutes: product.estimatedPrintMinutes,
            estimatedGrams: product.estimatedGrams,
            defaultMaterial: product.defaultMaterial
          }}
        />
      </PageSection>
    </PageShell>
  );
}
