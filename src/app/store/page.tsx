import { prisma } from "@/lib/prisma";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { StoreProductCard } from "@/components/store-product-card";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const products = await prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });

  return (
    <PageShell>
      <PageSection>
        <PageHero
          eyebrow="Approved products"
          title="Store"
          copy="Premade, tested products that enter the live print queue automatically after checkout."
        />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.length ? products.map((product) => (
          <StoreProductCard
            key={product.id}
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              description: product.description,
              imageUrl: product.imageUrl,
              modelUrl: product.productFileStorageKey && /\.stl$/i.test(product.productFileStorageKey) ? `/api/products/${product.id}/model` : null,
              priceCents: product.priceCents,
              estimatedPrintMinutes: product.estimatedPrintMinutes,
              defaultMaterial: product.defaultMaterial
            }}
          />
        )) : (
          <div className="md:col-span-3">
            <EmptyState title="No products published yet" copy="Approved products will appear here after the operator publishes the first catalog item." />
          </div>
        )}
      </div>
      </PageSection>
    </PageShell>
  );
}
