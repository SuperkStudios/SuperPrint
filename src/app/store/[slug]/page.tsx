import { notFound, redirect } from "next/navigation";
import { StoreProductCheckout } from "@/components/store-product-checkout";
import { PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const { slug } = await params;
  const [product, spools, session] = await Promise.all([
    prisma.product.findFirst({ where: { slug, status: "ACTIVE" } }),
    prisma.filamentSpool.findMany({
      where: { remainingGrams: { gt: 0 } },
      orderBy: [{ material: "asc" }, { color: "asc" }]
    }),
    getCurrentSession().catch(() => null)
  ]);
  if (!product) notFound();

  const materials = [...spools.reduce((map, spool) => {
    const existing = map.get(spool.material);
    if (existing) {
      if (!existing.colors.includes(spool.color)) existing.colors.push(spool.color);
    } else {
      map.set(spool.material, { material: spool.material, colors: [spool.color] });
    }
    return map;
  }, new Map<string, { material: string; colors: string[] }>()).values()];

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
