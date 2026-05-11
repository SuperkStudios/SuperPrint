import { AdminActionButton } from "@/components/admin-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFilamentPage() {
  const spools = await prisma.filamentSpool.findMany({ orderBy: { remainingGrams: "asc" } });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {spools.map((spool) => (
        <Card key={spool.id}>
          <CardHeader className="flex-row items-start justify-between">
            <CardTitle>{spool.color} {spool.material}</CardTitle>
            {spool.remainingGrams <= spool.thresholdGrams ? <Badge className="bg-secondary">Low</Badge> : <Badge>Ready</Badge>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{spool.brand} · {spool.location}</p>
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
                  remainingGrams: 1000,
                  thresholdGrams: spool.thresholdGrams,
                  location: spool.location
                }}
              >
                Mark refilled
              </AdminActionButton>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
