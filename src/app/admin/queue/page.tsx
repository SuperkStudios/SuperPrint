import { AdminActionButton } from "@/components/admin-action-button";
import { OperatorStartButton } from "@/components/operator-start-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { getAdminQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  await requireAdminPage("queue");
  const jobs = await getAdminQueueState();
  const queuedIds = jobs.filter((job) => job.status === "QUEUED").map((job) => job.id);
  const batches = buildPlateBatches(jobs.filter((job) => job.status === "QUEUED"));

  return (
    <div className="grid gap-4">
      {batches.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Suggested build plates</CardTitle>
            <p className="text-sm text-muted-foreground">Same product and color jobs are grouped up to each product&apos;s max build plate quantity.</p>
          </CardHeader>
          <CardContent className="grid gap-2">
            {batches.map((batch) => (
              <div key={batch.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                <span className="font-medium">{batch.productName}</span>
                <span className="text-muted-foreground">{batch.filamentLabel} · {batch.count} of {batch.max} on plate</span>
                <span className="text-muted-foreground">Queue #{batch.positions.join(", #")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{job.order.orderNumber}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.order.product?.name ?? job.order.upload?.fileName ?? "Custom job"} · {job.etaMinutes} min
              </p>
            </div>
            <Badge>{job.status}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              #{job.queuePosition ?? "-"} · {job.printer?.publicName ?? "Unassigned"} ·{" "}
              {job.filament ? `${job.filament.color} ${job.filament.material}` : "filament pending"}
              {job.assignmentBlockedReason ? ` · ${job.assignmentBlockedReason}` : ""}
              {job.readyOnNodeAt ? ` · Ready on node ${job.readyOnNodeAt.toLocaleString()}` : ""}
            </span>
            {job.status === "READY_ON_NODE" ? <OperatorStartButton printJobId={job.id} orderNumber={job.order.orderNumber} /> : null}
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "pause", printJobId: job.id }} confirm={`Pause print for ${job.order.orderNumber}?`}>
              Pause
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "complete", printJobId: job.id }} confirm={`Mark ${job.order.orderNumber} complete?`}>
              Complete
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "stop", printJobId: job.id }} confirm={`Stop ${job.order.orderNumber} without counting it as failed? Material/runtime will still be accounted.`}>
              Stop
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "fail", printJobId: job.id, reason: "Operator marked failed" }} confirm={`Fail ${job.order.orderNumber}? This will be visible in the event audit.`}>
              Fail
            </AdminActionButton>
            <AdminActionButton
              endpoint="/api/admin/queue"
              payload={{ action: "fail", printJobId: job.id, reason: "Operator marked failed and requested requeue", requeueAfterFailure: true }}
              confirm={`Fail and requeue ${job.order.orderNumber}? This records the failure before creating a fresh queue attempt.`}
            >
              Fail + Requeue
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "requeue", printJobId: job.id }} confirm={`Requeue ${job.order.orderNumber}?`}>
              Requeue
            </AdminActionButton>
          </CardContent>
        </Card>
      ))}
      {queuedIds.length > 1 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted-foreground">Batch exact spool/color jobs first, then prompt for the next filament change when needed.</p>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "optimizeMaterials" }}>
              Batch by color
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "reorder", orderedIds: [...queuedIds].reverse() }}>
              Reverse queued order
            </AdminActionButton>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function buildPlateBatches(jobs: Array<{
  id: string;
  queuePosition: number | null;
  filament?: { color: string; material: string } | null;
  order: { product?: { id: string; name: string; maxBatchQuantity: number } | null };
}>) {
  const groups = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const productId = job.order.product?.id ?? "custom";
    const filamentLabel = job.filament ? `${job.filament.color} ${job.filament.material}` : "filament pending";
    const key = `${productId}:${filamentLabel}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const sorted = [...group].sort((a, b) => (a.queuePosition ?? Number.MAX_SAFE_INTEGER) - (b.queuePosition ?? Number.MAX_SAFE_INTEGER));
    const max = Math.max(1, sorted[0]?.order.product?.maxBatchQuantity ?? 1);
    const batches = [];
    for (let index = 0; index < sorted.length; index += max) {
      const slice = sorted.slice(index, index + max);
      batches.push({
        key: `${key}:${index}`,
        productName: slice[0]?.order.product?.name ?? "Custom job",
        filamentLabel: slice[0]?.filament ? `${slice[0].filament.color} ${slice[0].filament.material}` : "filament pending",
        count: slice.length,
        max,
        positions: slice.map((job) => job.queuePosition ?? "?")
      });
    }
    return batches;
  });
}
