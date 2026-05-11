import { AdminActionButton } from "@/components/admin-action-button";
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
            </span>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "start", printJobId: job.id }}>
              Start
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "complete", printJobId: job.id }}>
              Complete
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "fail", printJobId: job.id, reason: "Operator marked failed" }}>
              Fail
            </AdminActionButton>
          </CardContent>
        </Card>
      ))}
      {queuedIds.length > 1 ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted-foreground">Demo reorder action reverses the queued jobs into contiguous positions.</p>
            <AdminActionButton endpoint="/api/admin/queue" payload={{ action: "reorder", orderedIds: [...queuedIds].reverse() }}>
              Reverse queued order
            </AdminActionButton>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
