import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { filamentColorToHex } from "@/lib/filament-colors";
import { buildAdminProductCatalogStats } from "@/domain/admin-products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdminPage("products");
  const [products, spools] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { remainingGrams: "desc" }] })
  ]);
  const materials = [...spools.reduce((map, spool) => {
    const existing = map.get(spool.material);
    if (existing) {
      if (!existing.colors.includes(spool.color)) existing.colors.push(spool.color);
    } else {
      map.set(spool.material, { material: spool.material, rollCostCents: spool.rollCostCents, colors: [spool.color] });
    }
    return map;
  }, new Map<string, { material: string; rollCostCents: number; colors: string[] }>()).values()];
  const stats = buildAdminProductCatalogStats(products);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Store products</h2>
          <p className="mt-2 text-sm text-muted-foreground">Manage the catalog customers can buy from and the print files behind each item.</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4" />
            Add product
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Archived" value={stats.archived} />
        <Stat label="Print files" value={stats.withPrintFiles} />
      </div>

      <div className="overflow-x-auto rounded-md border bg-card text-card-foreground shadow-sm">
        <div className="min-w-[760px]">
        <div className="grid grid-cols-[88px_1fr_120px_130px_120px] items-center gap-4 bg-muted px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Preview</span>
          <span>Product</span>
          <span>Status</span>
          <span>Print</span>
          <span className="text-right">Actions</span>
        </div>
        {products.length ? products.map((product) => (
          <div key={product.id} className="grid grid-cols-[88px_1fr_120px_130px_120px] items-center gap-4 border-t px-4 py-3">
            <div className="h-16 overflow-hidden rounded border bg-muted/20">
              {product.productFileStorageKey && /\.stl$/i.test(product.productFileStorageKey) ? (
                <StlModelViewer
                  src={`/api/products/${product.id}/model`}
                  color={filamentColorToHex(materials.find((item) => item.material === product.defaultMaterial)?.colors[0] ?? product.defaultMaterial)}
                  className="h-16 border-0"
                />
              ) : (
                <img src={product.imageUrl} alt="" className="h-16 w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{product.name}</p>
              <p className="truncate text-sm text-muted-foreground">{product.slug}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {money(product.priceCents)} · {product.estimatedPrintMinutes} min · {product.estimatedGrams}g · {product.defaultMaterial}
              </p>
            </div>
            <Badge className="w-fit">{product.status}</Badge>
            <p className="text-sm text-muted-foreground">{product.productFileStorageKey ? "Attached" : "Missing"}</p>
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/products/${product.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>
        )) : (
          <div className="border-t p-8 text-sm text-muted-foreground">No products yet. Add your first printable catalog item.</div>
        )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
