import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { StoreBuyButton } from "@/components/store-buy-button";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const [products, session] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    getCurrentSession().catch(() => null)
  ]);

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
          <Card key={product.id} className="overflow-hidden">
            <CardHeader>
              <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 text-white">
                <img src={product.imageUrl} alt="" className="h-full w-full rounded object-cover" />
              </div>
              <Badge className="w-fit bg-primary/10 text-primary">Queue-ready</Badge>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{money(product.priceCents)}</p>
                <p className="text-sm text-muted-foreground">{product.estimatedPrintMinutes} min · {product.defaultMaterial}</p>
              </div>
              <StoreBuyButton productId={product.id} signedIn={Boolean(session?.user.id)} />
            </CardContent>
          </Card>
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
