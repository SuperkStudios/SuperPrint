import { Activity, Boxes, ClipboardCheck, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, uploads, printers, maintenance] = await Promise.all([
    prisma.order.count(),
    prisma.modelUpload.count({ where: { status: "PENDING" } }),
    prisma.printer.findMany({ include: { currentFilament: true }, orderBy: { publicName: "asc" } }),
    prisma.maintenanceTask.count({ where: { status: { not: "COMPLETED" } } })
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-4">
      <Metric icon={Boxes} label="Orders" value={orders.toString()} />
      <Metric icon={Layers} label="Pending uploads" value={uploads.toString()} />
      <Metric icon={Activity} label="Printers" value={printers.length.toString()} />
      <Metric icon={ClipboardCheck} label="Open maintenance" value={maintenance.toString()} />
      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle>Printer health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {printers.map((printer) => (
            <div key={printer.id} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{printer.publicName}</p>
                <span className="text-sm text-muted-foreground">{printer.status}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{printer.healthDescription}</p>
              <p className="mt-3 text-sm">
                {printer.currentFilament
                  ? `${printer.currentFilament.color} ${printer.currentFilament.material} · ${printer.currentFilament.remainingGrams}g`
                  : "No filament assigned"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="size-5 text-primary" />
        <p className="mt-4 text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
