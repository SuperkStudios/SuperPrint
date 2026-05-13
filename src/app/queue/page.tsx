import { redirect } from "next/navigation";
import { CyberCard, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { LiveBedFeed } from "@/components/live/live-bed-feed";
import { TelemetryDashboard } from "@/components/live/telemetry-dashboard";
import { Badge } from "@/components/ui/badge";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { listPublicEvents } from "@/services/events";
import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const [queue, events] = await Promise.all([getPublicQueueState(), listPublicEvents(10)]);
  const current = queue.current;
  const printerName = current?.printer?.name ?? queue.printers[0]?.name ?? "SuperPrint cell";
  const currentPrint = current?.orderNumber ?? "Awaiting next approved job";

  return (
    <PageShell>
      <PageSection className="grid gap-8">
        <PageHero
          eyebrow="Live manufacturing"
          title="The queue is the product."
          copy="Watch the public-safe view of the factory: current job, ETA, printer health, material, camera feed, and the recent event trail."
        />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <LiveBedFeed printerName={printerName} currentPrint={currentPrint} />
          </div>
          <div className="grid gap-6">
            <TelemetryDashboard queue={queue} />
            <CyberCard>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Recent public events</h2>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-200">Sanitized feed</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {events.length ? events.map((event) => (
                  <div key={event.id} className="rounded-xl border bg-background/35 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{event.type.replaceAll("_", " ")}</span>
                      <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  </div>
                )) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Events will appear as production moves.</p>}
              </div>
            </CyberCard>
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
}
