import { redirect } from "next/navigation";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const [orders, uploads, jobs, completedJobs, stoppedJobs, failedJobs, consumed] = await Promise.all([
    prisma.order.count(),
    prisma.modelUpload.count(),
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "COMPLETED" } }),
    prisma.printJob.count({ where: { status: "STOPPED" } }),
    prisma.printJob.count({ where: { status: "FAILED" } }),
    prisma.printJob.aggregate({ _sum: { consumedFilamentGrams: true } })
  ]);
  const consumedGrams = consumed._sum.consumedFilamentGrams ?? 0;

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
        <Stat label="Stopped jobs" value={stoppedJobs} />
        <Stat label="Failed prints" value={failedJobs} />
        <Stat label="Accounted grams" value={consumedGrams} suffix="g" />
      </div>
    </main>
  );
}

function Stat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}{suffix}</p>
    </div>
  );
}
