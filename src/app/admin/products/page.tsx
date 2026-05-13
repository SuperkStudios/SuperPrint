import { AdminProductForm } from "@/components/admin-product-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, spools] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { remainingGrams: "desc" }] })
  ]);
  const materials = [...new Map(spools.map((spool) => [spool.material, { material: spool.material, rollCostCents: spool.rollCostCents }])).values()];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Add product</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create products customers can buy into the live manufacturing queue.</p>
        <div className="mt-4">
          <AdminProductForm materials={materials} />
        </div>
      </div>
      <div className="grid gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Catalog</h2>
        {products.length ? products.map((product) => (
          <Card key={product.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{product.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{product.slug}</p>
              </div>
              <Badge>{product.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[120px_1fr]">
              <img src={product.imageUrl} alt="" className="h-24 w-full rounded object-cover" />
              <div className="space-y-2 text-sm">
                <p>{product.description}</p>
                <p className="font-medium">{money(product.priceCents)} · {product.estimatedPrintMinutes} min · {product.estimatedGrams}g · {product.defaultMaterial}</p>
                <p className="text-muted-foreground">
                  Material cost {money(product.materialCostCents)}
                  {product.productFileStorageKey ? " · print file attached" : " · no print file yet"}
                </p>
                <AdminProductForm product={product} materials={materials} />
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">No products yet. Add your first printable catalog item.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
