import { AdminActionButton } from "@/components/admin-action-button";
import { AdminFilamentForm } from "@/components/admin-filament-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFilamentPage() {
  await requireAdminPage("filament");
  const spools = await prisma.filamentSpool.findMany({ where: { active: true }, orderBy: { remainingGrams: "asc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Add filament</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add each new 1kg roll to stock, then assign printers or completed history as needed.</p>
        <div className="mt-4">
          <AdminFilamentForm />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
      {spools.length ? spools.map((spool) => (
        <Card key={spool.id}>
          <CardHeader className="flex-row items-start justify-between">
            <CardTitle>{spool.color} {spool.material}</CardTitle>
            {spool.remainingGrams <= spool.thresholdGrams ? <Badge className="bg-secondary">Low</Badge> : <Badge>Ready</Badge>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{spool.brand} · {(spool.rollCostCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })} per 1kg roll</p>
            <div className="mt-4 h-2 rounded bg-muted">
              <div
                className="h-2 rounded bg-primary"
                style={{ width: `${Math.min(100, Math.max(4, spool.remainingGrams / 10))}%` }}
              />
            </div>
            <p className="mt-2 text-sm">{spool.remainingGrams}g remaining · threshold {spool.thresholdGrams}g</p>
            <div className="mt-4">
              <AdminActionButton
                endpoint="/api/admin/filament"
                payload={{
                  id: spool.id,
                  material: spool.material,
                  color: spool.color,
                  brand: spool.brand,
                  startingGrams: 1000,
                  remainingGrams: 1000,
                  thresholdGrams: spool.thresholdGrams,
                  rollCostCents: spool.rollCostCents,
                  location: "Stock"
                }}
              >
                Mark refilled
              </AdminActionButton>
            </div>
          </CardContent>
        </Card>
      )) : (
        <Card className="md:col-span-2">
          <CardContent className="p-8 text-sm text-muted-foreground">No filament rolls in stock yet. Add your first 1kg roll to start cost and material tracking.</CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
