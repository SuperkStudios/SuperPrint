import { AdminActionButton } from "@/components/admin-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const tasks = await prisma.maintenanceTask.findMany({
    include: { printer: true },
    orderBy: { dueAt: "asc" }
  });

  return (
    <div className="grid gap-4">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{task.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{task.printer.publicName} · due {task.dueAt.toDateString()}</p>
            </div>
            <Badge>{task.status}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm text-muted-foreground">{task.description}</p>
            <AdminActionButton endpoint="/api/admin/maintenance" payload={{ action: "start", taskId: task.id }}>
              Start
            </AdminActionButton>
            <AdminActionButton endpoint="/api/admin/maintenance" payload={{ action: "complete", taskId: task.id }}>
              Complete
            </AdminActionButton>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
