import { redirect } from "next/navigation";
import { CyberHomepage, type HomepageFilament, type HomepageStats } from "@/components/homepage/cyber-homepage";
import { calculateHomepageStats } from "@/domain/factory-stats";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { listPublicEvents } from "@/services/events";
import { getPublicFactoryEvolution } from "@/services/factory-evolution";
import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const [queue, events, completedPrints, failedPrints, stoppedPrints, printers, filament, factoryEvolution] = await Promise.all([
    getPublicQueueState(),
    listPublicEvents(10),
    prisma.printJob.count({ where: { status: "COMPLETED" } }),
    prisma.printJob.count({ where: { status: "FAILED" } }),
    prisma.printJob.count({ where: { status: "STOPPED" } }),
    prisma.printer.findMany({ include: { currentFilament: true }, orderBy: { publicName: "asc" } }),
    prisma.filamentSpool.findMany({ orderBy: { remainingGrams: "asc" }, take: 8 }),
    getPublicFactoryEvolution()
  ]);

  const stats: HomepageStats = calculateHomepageStats({
    completedPrints,
    failedPrints,
    stoppedPrints,
    runtimeMinutes: printers.reduce((total, printer) => total + printer.totalRuntimeMinutes, 0),
    filamentGramsUsed: filament.reduce((total, spool) => total + (spool.startingGrams - spool.remainingGrams), 0),
    activeQueueJobs: queue.nextJobs.length + (queue.current ? 1 : 0)
  });
  const activeSpoolIds = new Set(printers.map((printer) => printer.currentFilamentId).filter(Boolean));
  const liveFilament: HomepageFilament[] = filament.map((spool) => ({
    id: spool.id,
    material: spool.material,
    color: spool.color,
    remainingGrams: spool.remainingGrams,
    low: spool.remainingGrams <= spool.thresholdGrams,
    active: activeSpoolIds.has(spool.id)
  }));

  return <CyberHomepage queue={queue} events={events} stats={stats} filament={liveFilament} factoryEvolution={factoryEvolution} />;
}
