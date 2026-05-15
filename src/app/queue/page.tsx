import { redirect } from "next/navigation";
import { Activity, Clock, Gauge, Layers3, Sparkles, Upload } from "lucide-react";
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
  const material = current?.filament ?? queue.printers[0]?.filament ?? null;

  return (
    <main className="app-shell overflow-hidden text-foreground">
      <section className="relative border-b bg-card/45 py-10 dark:bg-zinc-950/90 lg:py-14">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.45)_58%,hsl(var(--background)))]" />
        <div className="factory-grid absolute inset-0 opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            <span className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-200">Live factory</span>
          </div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className={current ? "border-primary/30 bg-primary/10 text-primary" : "border-muted-foreground/20 bg-muted text-muted-foreground"}>
                {current ? "Now Printing" : "No Active Print"}
              </Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Real-Time 3D Manufacturing</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Watch the bed feed, printer telemetry, active order, queue, and sanitized production events from the same live surface as the home page.
              </p>
            </div>
            <div className="cyber-surface rounded-2xl p-4 text-sm">
              <p className="text-muted-foreground">Active job</p>
              <p className="mt-1 text-xl font-semibold">{currentPrint}</p>
            </div>
          </div>

          <div className="mt-6 cyber-surface rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{currentPrint}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {current?.filament ? `${current.filament.color} ${current.filament.material} · ETA ${current.etaMinutes}m` : "Ready for the next paid store order."}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200">
                <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
                {current?.status ?? queue.printers[0]?.status ?? "IDLE"}
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary shadow-[0_0_22px_hsl(var(--primary)/0.55)]" style={{ width: `${Math.max(0, Math.min(100, current?.progressPercent ?? 0))}%` }} />
            </div>
          </div>

          <div className="mt-5">
            <LiveBedFeed printerName={printerName} currentPrint={currentPrint} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <LiveMetric icon={Layers3} label="Layer progress" value={current?.telemetry?.state === "LIVE" ? `Layer ${current.telemetry.currentLayer ?? "--"} · ${current.telemetry.progressPercent ?? 0}%` : "Layer -- · 0%"} />
            <LiveMetric icon={Gauge} label="Nozzle temp" value={current?.telemetry?.state === "LIVE" ? `${Math.round(current.telemetry.nozzleTempC ?? 0)}C` : "Waiting"} />
            <LiveMetric icon={Clock} label="Time remaining" value={`${current?.etaMinutes ?? 0}m`} />
            <LiveMetric icon={Activity} label="Material + color" value={material ? `${material.color} ${material.material}` : "Material pending"} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <TelemetryDashboard queue={queue} />
            <div className="cyber-surface rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Recent public events</h2>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-200">Sanitized feed</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {events.length ? events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 rounded-xl border bg-background/35 p-3 text-sm">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {event.type.includes("QUEUE") ? <Upload className="size-4 text-primary" /> : <Sparkles className="size-4 text-orange-500 dark:text-orange-200" />}
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{event.type.replaceAll("_", " ")}</span>
                      <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  </div>
                )) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Events will appear as production moves.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LiveMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="cyber-surface rounded-2xl p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
