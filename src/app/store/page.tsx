import { prisma } from "@/lib/prisma";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { StoreProductCard } from "@/components/store-product-card";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const [products, spools, session] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { color: "asc" }] }),
    getCurrentSession().catch(() => null)
  ]);
  const colorsByMaterial = spools.reduce((map, spool) => {
    const colors = map.get(spool.material) ?? [];
    if (!colors.includes(spool.color)) colors.push(spool.color);
    map.set(spool.material, colors);
    return map;
  }, new Map<string, string[]>());

  return (
    <PageShell>
      <PageSection>
        <PageHero
          eyebrow="Approved products"
          title="Print-ready catalog"
          copy="Products here are already printable, priced, and ready to enter the live manufacturing queue after checkout."
        />
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {products.length ? products.map((product) => (
          <StoreProductCard
            key={product.id}
            signedIn={Boolean(session?.user.id)}
            colors={colorsByMaterial.get(product.defaultMaterial) ?? []}
            product={{
              id: product.id,
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
