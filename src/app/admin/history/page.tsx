import { AdminPrinterHistoryPanel } from "@/components/admin-printer-history-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHistoryPage() {
  const spools = await prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { color: "asc" }] });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past printer history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pull completed Centauri jobs, assign material usage to stock, ignore tests, or import past work as completed SuperPrint jobs.
        </p>
      </CardHeader>
      <CardContent>
        <AdminPrinterHistoryPanel
          spools={spools.map((spool) => ({
            id: spool.id,
            label: `${spool.color} ${spool.material} ${spool.brand} (${spool.remainingGrams}g left)`
          }))}
        />
      </CardContent>
    </Card>
  );
}
