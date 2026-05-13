import { redirect } from "next/navigation";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { MetricTile, PageHero, PageSection, PageShell } from "@/components/cyber-page";

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
    <PageShell>
      <PageSection>
      <PageHero eyebrow="Stats" title="Factory activity" copy="Public-safe operating totals for the local SuperPrint instance." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile label="Orders" value={orders} />
        <MetricTile label="Model uploads" value={uploads} />
        <MetricTile label="Print jobs" value={jobs} />
        <MetricTile label="Completed prints" value={completedJobs} />
        <MetricTile label="Stopped jobs" value={stoppedJobs} />
        <MetricTile label="Failed prints" value={failedJobs} />
        <MetricTile label="Accounted grams" value={`${consumedGrams}g`} />
      </div>
      </PageSection>
    </PageShell>
  );
}
