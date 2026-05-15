import { AdminActionButton } from "@/components/admin-action-button";
import { OperatorStartButton } from "@/components/operator-start-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const jobs = await getAdminQueueState();
  const queuedIds = jobs.filter((job) => job.status === "QUEUED").map((job) => job.id);

  return (
    <div className="grid gap-4">
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
            <p className="text-sm text-muted-foreground">Batch compatible filament jobs first, or reverse queued jobs into contiguous positions.</p>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "optimizeMaterials" }}>
              Batch by loaded filament
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
