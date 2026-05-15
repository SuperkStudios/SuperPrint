import { PackageCheck, Truck } from "lucide-react";
import { AdminActionButton } from "@/components/admin-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdminPage("orders");
  const orders = await prisma.order.findMany({
    include: { customer: true, product: true, upload: true, printJobs: { include: { filament: true, printer: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
  const readyToPack = orders.filter((order) => order.status === "COMPLETED" && !["SHIPPED", "DELIVERED"].includes(order.shippingStatus));
  const active = orders.filter((order) => !["COMPLETED", "FAILED", "CANCELED", "STOPPED"].includes(order.status));

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Ready to pack" value={readyToPack.length} />
        <Metric label="Active orders" value={active.length} />
        <Metric label="Awaiting shipment" value={orders.filter((order) => order.shippingStatus === "PACKING").length} />
      </div>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Package and ship</h2>
        {readyToPack.length ? readyToPack.map((order) => <OrderCard key={order.id} order={order} />) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No completed orders are waiting for packaging.</CardContent></Card>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">All orders</h2>
        {orders.map((order) => <OrderCard key={order.id} order={order} />)}
      </section>
    </div>
  );
}

function OrderCard({ order }: { order: {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus: string;
  totalCents: number;
  selectedColor: string | null;
  selectedMaterial: string | null;
  customer?: { email: string } | null;
  product?: { name: string } | null;
  upload?: { fileName: string } | null;
  printJobs: Array<{
    status: string;
    queuePosition: number | null;
    printer?: { publicName: string } | null;
    filament?: { color: string; material: string } | null;
  }>;
} }) {
  const latestJob = order.printJobs[0];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{order.orderNumber}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{order.product?.name ?? order.upload?.fileName ?? "Custom order"} · {order.customer?.email}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge>{order.status}</Badge>
          <Badge className="bg-secondary">{order.shippingStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-2 text-sm md:grid-cols-4">
          <span><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</span>
          <span><span className="text-muted-foreground">Material</span><br />{order.selectedColor ?? latestJob?.filament?.color ?? "-"} {order.selectedMaterial ?? latestJob?.filament?.material ?? ""}</span>
          <span><span className="text-muted-foreground">Printer</span><br />{latestJob?.printer?.publicName ?? "Unassigned"}</span>
          <span><span className="text-muted-foreground">Queue</span><br />{latestJob?.queuePosition ? `#${latestJob.queuePosition}` : latestJob?.status ?? "Not queued"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminActionButton endpoint="/api/admin/orders" payload={{ action: "markPacking", orderId: order.id }}>
            <PackageCheck className="h-4 w-4" />
            Packing
          </AdminActionButton>
          <AdminActionButton endpoint="/api/admin/orders" payload={{ action: "markShipped", orderId: order.id }} confirm={`Mark ${order.orderNumber} shipped?`}>
            <Truck className="h-4 w-4" />
            Shipped
          </AdminActionButton>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
