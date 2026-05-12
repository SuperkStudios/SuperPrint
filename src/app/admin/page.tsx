import { Activity, AlertTriangle, Boxes, ClipboardCheck, DatabaseBackup, Layers, Radio, Server } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPublicEvents } from "@/services/events";
import { getAdminQueueState } from "@/services/queue";
import { getDataRoot } from "@/lib/storage";
import { refreshAllPrinterHeartbeats } from "@/services/printer-heartbeat";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, uploads, printers, maintenance, jobs, events, filament, products, media, consumed] = await Promise.all([
    prisma.order.count(),
    prisma.modelUpload.findMany({ where: { status: "PENDING" }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    refreshAllPrinterHeartbeats(),
    prisma.maintenanceTask.findMany({ where: { status: { not: "COMPLETED" } }, include: { printer: true }, orderBy: { dueAt: "asc" }, take: 4 }),
    getAdminQueueState(),
    listPublicEvents(8),
    prisma.filamentSpool.findMany({ orderBy: { remainingGrams: "asc" }, take: 4 }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.orderVideo.count(),
    prisma.printJob.aggregate({ _sum: { consumedFilamentGrams: true } })
  ]);
  const activeJob = jobs.find((job) => job.status === "PRINTING");
  const queuedJobs = jobs.filter((job) => job.status === "QUEUED");
  const completedJobs = jobs.filter((job) => job.status === "COMPLETED").length;
  const stoppedJobs = jobs.filter((job) => ["FAILED", "PAUSED", "CANCELED"].includes(job.status)).length;
  const accountedGrams = consumed._sum.consumedFilamentGrams ?? 0;

  return (
    <div className="grid gap-6 md:grid-cols-4">
      <Metric icon={Boxes} label="Orders" value={orders.toString()} />
      <Metric icon={Layers} label="Pending uploads" value={uploads.length.toString()} />
      <Metric icon={Activity} label="Printers" value={printers.length.toString()} />
      <Metric icon={ClipboardCheck} label="Open maintenance" value={maintenance.length.toString()} />
      <Metric icon={ClipboardCheck} label="Completed prints" value={completedJobs.toString()} />
      <Metric icon={AlertTriangle} label="Stopped jobs" value={stoppedJobs.toString()} />
      <Metric icon={Boxes} label="Accounted material" value={`${accountedGrams}g`} />
      <Metric icon={DatabaseBackup} label="Media records" value={media.toString()} />

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Active job</CardTitle>
        </CardHeader>
        <CardContent>
          {activeJob ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{activeJob.order.orderNumber}</p>
                <Badge>{activeJob.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeJob.order.product?.name ?? activeJob.order.upload?.fileName} · {activeJob.printer?.publicName} · {activeJob.etaMinutes} min ETA
              </p>
              <div className="mt-5 h-2 rounded bg-muted"><div className="h-2 w-2/3 rounded bg-primary" /></div>
            </div>
          ) : (
            <Empty label="No active print. Start the next queued job when the printer is ready." />
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <StatusRow icon={Server} label="Printer registered" value={printers.length ? "Complete" : "Add first printer"} />
          <StatusRow icon={Radio} label="Filament available" value={filament.length ? "Complete" : "Add first spool"} />
          <StatusRow icon={Boxes} label="Products published" value={products ? `${products} active` : "No products published"} />
          <StatusRow icon={DatabaseBackup} label="Media attached" value={media ? `${media} records` : "No finished media yet"} />
        </CardContent>
      </Card>

      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle>Storage and backup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <StatusRow icon={Server} label="Data root" value={getDataRoot()} />
          <StatusRow icon={DatabaseBackup} label="Backup staging" value={`${getDataRoot()}/backup-staging`} />
          <StatusRow icon={Radio} label="Backup upload" value={process.env.SOCIAL_BLADE_BUCKET ? "Configured" : "Dry run"} />
        </CardContent>
      </Card>

      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle>Printer health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {printers.map((printer) => (
            <div key={printer.id} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{printer.publicName}</p>
                <span className={printer.heartbeatStatus === "ONLINE" ? "text-sm text-emerald-600" : "text-sm text-muted-foreground"}>
                  {printer.heartbeatStatus === "ONLINE" ? "Online" : "Offline"}
                </span>
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

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {queuedJobs.length ? queuedJobs.slice(0, 5).map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <span>{job.order.orderNumber}</span>
              <span className="text-muted-foreground">#{job.queuePosition} · {job.etaMinutes} min</span>
            </div>
          )) : <Empty label="No queued work." />}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Uploads needing review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {uploads.length ? uploads.map((upload) => (
            <div key={upload.id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between"><span className="font-medium">{upload.fileName}</span><Badge>{upload.status}</Badge></div>
              <p className="mt-1 text-muted-foreground">{upload.customer.email} · {upload.fileSizeBytes ? `${Math.round(upload.fileSizeBytes / 1024)} KB` : "size unknown"}</p>
            </div>
          )) : <Empty label="No pending uploads." />}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Filament</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {filament.map((spool) => (
            <div key={spool.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <span>{spool.color} {spool.material}</span>
              <span className={spool.remainingGrams <= spool.thresholdGrams ? "text-destructive" : "text-muted-foreground"}>{spool.remainingGrams}g</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {maintenance.length ? maintenance.map((task) => (
            <div key={task.id} className="rounded border p-3 text-sm">
              <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-secondary" /><span className="font-medium">{task.title}</span></div>
              <p className="mt-1 text-muted-foreground">{task.printer.publicName} · {task.status}</p>
            </div>
          )) : <Empty label="Maintenance queue is clear." />}
        </CardContent>
      </Card>

      <Card className="md:col-span-4">
        <CardHeader><CardTitle>Audit feed</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {events.map((event) => (
            <div key={event.id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{event.type.replaceAll("_", " ")}</span>
                <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 truncate text-muted-foreground">{JSON.stringify(event.payload)}</p>
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

function StatusRow({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded border p-3">
      <Icon className="size-4 text-primary" />
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded border border-dashed p-5 text-sm text-muted-foreground">{label}</div>;
}
