import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminProductForm } from "@/components/admin-product-form";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { calculateProductPriceOptions } from "@/services/pricing";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("products");
  const { id } = await params;
  const [product, materials, pricingQuotes] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { allowedFilaments: true } }),
    loadMaterialOptions(),
    calculateProductPriceOptions(id).catch(() => [])
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Edit product</h2>
          <p className="mt-2 text-sm text-muted-foreground">{product.name}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
        </Button>
      </div>
      <AdminProductForm product={product} materials={materials} pricingQuotes={pricingQuotes} />
    </div>
  );
}

async function loadMaterialOptions() {
  const spools = await prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { remainingGrams: "desc" }] });
  return spools.map((spool) => ({
    id: spool.id,
    material: spool.material,
    rollCostCents: spool.rollCostCents,
    color: spool.color,
    brand: spool.brand,
    remainingGrams: spool.remainingGrams,
    requiresAdminApproval: spool.requiresAdminApproval
  }));
}
