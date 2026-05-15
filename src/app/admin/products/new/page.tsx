import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminProductForm } from "@/components/admin-product-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const materials = await loadMaterialOptions();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Add product</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create one store item with its customer-facing media and print file.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
        </Button>
      </div>
      <AdminProductForm materials={materials} />
    </div>
  );
}

async function loadMaterialOptions() {
  const spools = await prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { remainingGrams: "desc" }] });
  return [...spools.reduce((map, spool) => {
    const existing = map.get(spool.material);
    if (existing) {
      if (!existing.colors.includes(spool.color)) existing.colors.push(spool.color);
    } else {
      map.set(spool.material, { material: spool.material, rollCostCents: spool.rollCostCents, colors: [spool.color] });
    }
    return map;
  }, new Map<string, { material: string; rollCostCents: number; colors: string[] }>()).values()];
}
