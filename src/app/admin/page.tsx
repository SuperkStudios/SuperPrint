import Link from "next/link";
import { AlertTriangle, Boxes, Clock3, PackageCheck, Radio, RefreshCw, Truck, Users } from "lucide-react";
import { AdminActionButton } from "@/components/admin-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { refreshAllPrinterHeartbeats } from "@/services/printer-heartbeat";
import { getAdminQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage("dashboard");
  const [orders, jobs, printers, filament, uploads, customers] = await Promise.all([
    prisma.order.findMany({
      include: { customer: true, product: true, upload: true, printJobs: { include: { filament: true, printer: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 40
    }),
    getAdminQueueState(),
    refreshAllPrinterHeartbeats(),
    prisma.filamentSpool.findMany({ orderBy: { remainingGrams: "asc" }, take: 8 }),
    prisma.modelUpload.findMany({ where: { status: "PENDING" }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.user.count({ where: { role: "CUSTOMER" } })
  ]);

  const needsPackaging = orders.filter((order) => order.status === "COMPLETED" && !["SHIPPED", "DELIVERED"].includes(order.shippingStatus));
  const queuedJobs = jobs.filter((job) => ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START"].includes(job.status));
  const activePrint = jobs.find((job) => job.status === "PRINTING");
  const printerById = new Map(printers.map((printer) => [printer.id, printer]));
  const swapJobs = queuedJobs.filter((job) => {
    const printerFilamentId = job.printerId ? printerById.get(job.printerId)?.currentFilamentId : null;
    return job.filamentId && printerFilamentId && job.filamentId !== printerFilamentId;
  });
  const statusCounts = countBy(orders, (order) => order.status);
  const revenueCents = orders.reduce((total, order) => total + order.totalCents, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={PackageCheck} label="Pack/ship now" value={needsPackaging.length.toString()} />
        <Metric icon={Clock3} label="Queue work" value={queuedJobs.length.toString()} />
        <Metric icon={RefreshCw} label="Filament swaps" value={swapJobs.length.toString()} />
        <Metric icon={Users} label="Customers" value={customers.toString()} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Package and ship</CardTitle>
              <p className="text-sm text-muted-foreground">Completed prints that still need operator handling.</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/admin/orders">All orders</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {needsPackaging.length ? needsPackaging.slice(0, 6).map((order) => (
              <div key={order.id} className="grid gap-3 rounded border p-3 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">{order.orderNumber} · {order.product?.name ?? order.upload?.fileName ?? "Custom order"}</p>
                  <p className="text-sm text-muted-foreground">{order.customer.email} · {money(order.totalCents)} · {order.shippingStatus}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminActionButton endpoint="/api/admin/orders" payload={{ action: "markPacking", orderId: order.id }}>
                    <PackageCheck className="h-4 w-4" />
                    Packing
                  </AdminActionButton>
                  <AdminActionButton endpoint="/api/admin/orders" payload={{ action: "markShipped", orderId: order.id }}>
                    <Truck className="h-4 w-4" />
                    Shipped
                  </AdminActionButton>
                </div>
              </div>
            )) : <Empty label="No orders need packaging right now." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order mix</CardTitle>
            <p className="text-sm text-muted-foreground">{money(revenueCents)} total booked locally.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <Bar key={status} label={status} value={count} max={orders.length || 1} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <CardTitle>Queue order</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/admin/queue">Open queue</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activePrint ? <QueueRow job={activePrint} highlight="Printing now" /> : null}
            {queuedJobs.length ? queuedJobs.slice(0, 7).map((job) => <QueueRow key={job.id} job={job} />) : <Empty label="No queued jobs." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filament swaps</CardTitle>
            <p className="text-sm text-muted-foreground">Jobs likely to need an operator material change.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {swapJobs.length ? swapJobs.slice(0, 6).map((job) => (
              <div key={job.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{job.order.orderNumber}</p>
                <p className="text-muted-foreground">
                  {job.printer?.publicName}: loaded {job.printerId ? printerById.get(job.printerId)?.currentFilament?.color ?? "-" : "-"} {job.printerId ? printerById.get(job.printerId)?.currentFilament?.material ?? "" : ""}
                  {" -> "}needs {job.filament?.color} {job.filament?.material}
                </p>
              </div>
            )) : <Empty label="No upcoming filament swaps detected." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Printer health</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {printers.map((printer) => (
              <div key={printer.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>{printer.publicName}</span>
                <Badge className={printer.heartbeatStatus === "ONLINE" ? "bg-emerald-600" : "bg-zinc-500"}>{printer.heartbeatStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Low filament</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {filament.map((spool) => (
              <div key={spool.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{spool.color} {spool.material}</span>
                  <span className={spool.remainingGrams <= spool.thresholdGrams ? "text-destructive" : "text-muted-foreground"}>{spool.remainingGrams}g</span>
                </div>
                <div className="mt-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, Math.max(4, spool.remainingGrams / 10))}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Uploads to review</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {uploads.length ? uploads.map((upload) => (
              <Link key={upload.id} href="/admin/uploads" className="rounded border p-3 text-sm hover:bg-muted">
                <p className="font-medium">{upload.fileName}</p>
                <p className="text-muted-foreground">{upload.customer.email}</p>
              </Link>
            )) : <Empty label="Upload review queue is clear." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QueueRow({ job, highlight }: { job: Awaited<ReturnType<typeof getAdminQueueState>>[number]; highlight?: string }) {
  return (
    <div className="grid gap-2 rounded border p-3 text-sm md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-medium">{job.order.orderNumber} · {job.order.product?.name ?? job.order.upload?.fileName ?? "Custom job"}</p>
        <p className="text-muted-foreground">#{job.queuePosition ?? "-"} · {job.etaMinutes} min · {job.filament ? `${job.filament.color} ${job.filament.material}` : "filament pending"}</p>
      </div>
      <Badge className={highlight ? "bg-primary" : undefined}>{highlight ?? job.status}</Badge>
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

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{value}</span></div>
      <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">{label}</div>;
}

function countBy<T>(items: T[], pick: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = pick(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
