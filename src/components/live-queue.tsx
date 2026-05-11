import Link from "next/link";
import { Activity, CheckCircle2, Clock, Cpu, Radio, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type QueueState = Awaited<ReturnType<typeof import("@/services/queue").getPublicQueueState>>;
type PublicEvent = Awaited<ReturnType<typeof import("@/services/events").listPublicEvents>>[number];

export function LiveQueue({ queue, events = [] }: { queue: QueueState; events?: PublicEvent[] }) {
  const current = queue.current;

  return (
    <section className="bg-zinc-950 py-14 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-100">
              Observable manufacturing
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Live factory queue</h2>
            <p className="mt-3 max-w-2xl text-zinc-300">
              Customers see the same queue that drives production: current print, ETA, filament state,
              printer health, and post-print video availability.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/queue">
              <Radio className="size-4" />
              Watch queue
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="factory-grid overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
            <div className="grid gap-0 md:grid-cols-[1fr_280px]">
              <div className="min-h-[360px] p-6">
                <div className="flex items-center justify-between">
                  <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">Current print</Badge>
                  <span className="flex items-center gap-2 text-sm text-zinc-300">
                    <Activity className="size-4 text-emerald-300" />
                    {current?.status ?? "IDLE"}
                  </span>
                </div>
                <div className="mt-10 flex min-h-[230px] items-end justify-center gap-6">
                  <div className="relative h-44 w-52 rounded border border-cyan-200/50 bg-cyan-200/10 shadow-[0_0_70px_rgba(34,211,238,0.24)]">
                    <div className="absolute bottom-0 left-0 right-0 rounded-b bg-cyan-300/30" style={{ height: `${current?.progressPercent ?? 12}%` }} />
                    <div className="absolute inset-x-5 top-8 h-16 rounded bg-zinc-950/70 ring-1 ring-cyan-200/20" />
                    <div className="absolute bottom-8 left-8 right-8 h-5 rounded bg-emerald-300/50" />
                  </div>
                  <div className="h-60 w-12 rounded bg-amber-300/80 p-1 shadow-[0_0_40px_rgba(252,211,77,0.25)]">
                    <div className="h-full rounded bg-zinc-950/20" />
                  </div>
                  <div className="h-24 w-64 rounded border border-emerald-200/50 bg-emerald-200/10" />
                </div>
                <div className="mt-8">
                  <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>Progress</span>
                    <span>{current?.progressPercent ?? 0}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded bg-white/10">
                    <div className="h-2 rounded bg-cyan-300" style={{ width: `${current?.progressPercent ?? 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 bg-black/25 p-6 md:border-l md:border-t-0">
                <p className="text-sm text-zinc-400">Order</p>
                <p className="mt-1 text-2xl font-semibold">{current?.orderNumber ?? "No active job"}</p>
                <div className="mt-6 grid gap-4 text-sm">
                  <Metric icon={Cpu} label="Printer" value={current?.printer?.name ?? "Standby"} />
                  <Metric icon={Clock} label="ETA" value={`${current?.etaMinutes ?? 0} min`} />
                  <Metric
                    icon={Activity}
                    label="Filament"
                    value={
                      current?.filament
                        ? `${current.filament.color} ${current.filament.material}`
                        : "Not loaded"
                    }
                  />
                  <Metric icon={ShieldCheck} label="Health" value={current?.printer?.healthDescription ?? "No active printer"} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-lg border border-white/10 bg-zinc-900 p-5">
              <h3 className="text-lg font-semibold">Next jobs</h3>
              <div className="mt-4 space-y-3">
                {queue.nextJobs.length ? queue.nextJobs.map((job) => (
                <div key={job.id} className="rounded border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{job.orderNumber}</span>
                    <Badge className="border-amber-200/30 bg-amber-200/10 text-amber-100">
                      #{job.queuePosition}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">
                    {job.printer?.name ?? "Assigning printer"} · {job.etaMinutes} min ·{" "}
                    {job.filament ? `${job.filament.color} ${job.filament.material}` : "filament pending"}
                  </p>
                </div>
                )) : <EmptyDark label="Queue is clear" />}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900 p-5">
              <h3 className="text-lg font-semibold">Recent events</h3>
              <div className="mt-4 space-y-3">
                {events.length ? events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex gap-3 rounded border border-white/10 bg-white/[0.03] p-3 text-sm">
                    <Zap className="mt-0.5 size-4 text-amber-200" />
                    <div>
                      <p className="font-medium">{event.type.replaceAll("_", " ")}</p>
                      <p className="text-zinc-400">{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                  </div>
                )) : <EmptyDark label="Events will appear as jobs move" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyDark({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-white/10 p-5 text-sm text-zinc-400">
      <CheckCircle2 className="mb-3 size-5 text-emerald-200" />
      {label}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 text-cyan-200" />
      <div>
        <p className="text-zinc-500">{label}</p>
        <p className="text-zinc-100">{value}</p>
      </div>
    </div>
  );
}
