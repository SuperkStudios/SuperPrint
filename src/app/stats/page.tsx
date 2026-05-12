import { redirect } from "next/navigation";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const [orders, uploads, jobs, completedJobs, events, media] = await Promise.all([
    prisma.order.count(),
    prisma.modelUpload.count(),
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "COMPLETED" } }),
    prisma.platformEvent.count(),
    prisma.orderVideo.count()
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Stats</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Factory activity</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Public-safe operating totals for the local SuperPrint instance.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Orders" value={orders} />
        <Stat label="Model uploads" value={uploads} />
        <Stat label="Print jobs" value={jobs} />
        <Stat label="Completed prints" value={completedJobs} />
        <Stat label="Events emitted" value={events} />
        <Stat label="Media attachments" value={media} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
