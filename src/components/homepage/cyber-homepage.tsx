"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, Camera, CheckCircle2, CircuitBoard, Clock, Eye, Gauge, Layers3, Leaf, PackageCheck, Radio, Recycle, ShieldCheck, Timer, Upload, Video } from "lucide-react";
import { LiveBedFeed } from "@/components/live/live-bed-feed";
import { FactoryEvolutionDashboard } from "@/components/factory/factory-evolution-dashboard";
import { PrinterHeroVisual } from "@/components/homepage/printer-hero-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePrinterFeedStatus } from "@/hooks/use-printer-feed-status";
import type { getPublicFactoryEvolution } from "@/services/factory-evolution";

type QueueState = Awaited<ReturnType<typeof import("@/services/queue").getPublicQueueState>>;
type PublicEvent = Awaited<ReturnType<typeof import("@/services/events").listPublicEvents>>[number];
export type HomepageStats = {
  completedPrints: number;
  runtimeHours: number;
  successRate: number;
  filamentKg: number;
  activeQueueJobs: number;
};

export type HomepageFilament = {
  id: string;
  material: string;
  color: string;
  remainingGrams: number;
  low: boolean;
  active: boolean;
};

export function CyberHomepage({
  queue,
  events,
  stats,
  filament,
  factoryEvolution
}: {
  queue: QueueState;
  events: PublicEvent[];
  stats: HomepageStats;
  filament: HomepageFilament[];
  factoryEvolution: Awaited<ReturnType<typeof getPublicFactoryEvolution>>;
}) {
  return (
    <main className="app-shell overflow-hidden text-foreground">
      <section className="relative">
        <CyberBackground />
        <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <Badge className="border-primary/30 bg-primary/10 text-primary">Live 3D printing from upload to pickup</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl">
              Watch Your Print Come To Life
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              SuperPrint turns custom 3D printing into a visible workflow: upload a model, see the queue, track the printer, and get a finished part without guessing what happened.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild className="h-12 px-5">
                <Link href="/upload">Start Printing <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-5 bg-card/50">
                <Link href="/queue">Watch Live Queue</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroStat label="Completed Prints" value={stats.completedPrints} />
              <HeroStat label="Success Rate" value={stats.successRate} suffix="%" />
              <HeroStat label="Filament Tracked" value={stats.filamentKg} suffix="kg" />
              <HeroStat label="Active Queue Jobs" value={stats.activeQueueJobs} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96, y: 26 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative">
            <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl" />
            <div className="cyber-surface relative rounded-[1.5rem] p-4">
              <div className="absolute inset-x-8 top-4 z-10 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
              <PrinterHeroVisual progressPercent={queue.current?.progressPercent ?? (queue.current?.telemetry?.state === "LIVE" ? queue.current.telemetry.progressPercent : 0) ?? 0} />
            </div>
          </motion.div>
        </div>
      </section>

      <LiveFactorySection queue={queue} events={events} />
      <FactoryEvolutionDashboard data={factoryEvolution} compact />
      <HowItWorks />
      <ProofSection />
      <FeatureGrid />
      <InventorySection filament={filament} />
      <StatsSection stats={stats} />
      <UpgradePreviewSection />
      <FinalCta />
    </main>
  );
}

export function LiveFactorySection({ queue, events: _events }: { queue: QueueState; events: PublicEvent[] }) {
  const livePrinter = usePrinterFeedStatus();
  const current = queue.current;
  const centauriTelemetry = livePrinter?.telemetry?.state === "LIVE" ? livePrinter.telemetry : null;
  const telemetry = centauriTelemetry ?? (current?.telemetry?.state === "LIVE" ? current.telemetry : null);
  const printerName = current?.printer?.name ?? queue.printers[0]?.name ?? "SuperPrint cell";
  const currentPrint = current?.orderNumber ?? "Awaiting next approved job";
  const progressPercent = current?.progressPercent ?? telemetry?.progressPercent ?? 0;
  const isPrinting = Boolean(current) || centauriTelemetry?.machineStatus === 1;
  const activeStatusLabel = isPrinting ? "Now Printing" : "No Active Print";
  const activePrintTitle = current?.orderNumber ?? (centauriTelemetry?.machineStatus === 1 ? (centauriTelemetry.currentFileName ?? "Printer active outside SuperPrint queue") : "Awaiting next approved job");
  const activePrintDetails = current?.filament
    ? `${current.filament.color} ${current.filament.material} · ETA ${current.etaMinutes}m`
    : centauriTelemetry?.machineStatus === 1
      ? `Live printer job · ${formatRemaining(centauriTelemetry.remainingSeconds)} remaining`
      : "No approved print is currently assigned.";
  const printerStatus = livePrinter?.online ? centauriTelemetry?.machineStatusLabel ?? "Online" : current?.status ?? "IDLE";
  const currentLayer = telemetry && "currentLayer" in telemetry ? telemetry.currentLayer : null;
  const totalLayer = centauriTelemetry?.totalLayer ?? null;
  const material = current?.filament ?? queue.printers[0]?.filament ?? null;

  return (
      <section className="relative border-y bg-card/45 py-16 dark:bg-zinc-950/90 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.12),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.08),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            <span className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-200">Live factory</span>
          </div>

          <div className="cyber-surface rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className={isPrinting ? "border-primary/30 bg-primary/10 text-primary" : "border-muted-foreground/20 bg-muted text-muted-foreground"}>{activeStatusLabel}</Badge>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{activePrintTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{activePrintDetails}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200">
                <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
                {printerStatus}
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary shadow-[0_0_22px_hsl(var(--primary)/0.55)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, progressPercent ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-5">
            <LiveBedFeed printerName={printerName} currentPrint={currentPrint} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <LiveMetric icon={Layers3} label="Layer progress" value={formatLayerProgress(currentLayer, totalLayer, progressPercent)} />
            <LiveMetric icon={Gauge} label="Temperatures" value={formatCombinedTemps(telemetry?.nozzleTempC, centauriTelemetry?.nozzleTargetC, telemetry?.bedTempC, centauriTelemetry?.bedTargetC)} />
            <LiveMetric icon={Clock} label="Time remaining" value={telemetry?.remainingSeconds != null ? formatRemaining(telemetry.remainingSeconds) : `${current?.etaMinutes ?? 0}m`} />
            <LiveMetric icon={Boxes} label="Material + color" value={material ? `${material.color} ${material.material}` : "Material pending"} swatch={material?.color} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="cyber-surface rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Queue</h3>
                <Upload className="size-4 text-primary" />
              </div>
              <div className="mt-4 space-y-3">
                {queue.nextJobs.length ? queue.nextJobs.slice(0, 5).map((job) => (
                  <motion.div key={job.id} layout className="flex items-center justify-between rounded-xl border bg-background/35 p-3 text-sm">
                    <span className="font-medium text-foreground">{job.orderNumber}</span>
                    <span className="text-muted-foreground">#{job.queuePosition ?? "?"} · {job.etaMinutes}m</span>
                  </motion.div>
                )) : (
                  <div className="rounded-xl border border-dashed bg-background/25 p-4 text-sm text-muted-foreground">Queue is clear. New approved jobs will appear here.</div>
                )}
              </div>
            </div>

            <div className="cyber-surface rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">History</h3>
                <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-200" />
              </div>
              <div className="mt-4 space-y-3">
                {queue.recentPrints.slice(0, 5).map((print) => (
                  <RecentPrintRow key={print.id} print={print} />
                ))}
                {!queue.recentPrints.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Completed prints will appear here.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

function CyberBackground() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,hsl(var(--primary)/0.16),transparent_32rem),linear-gradient(245deg,hsl(var(--secondary)/0.12),transparent_30rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.52)_55%,hsl(var(--background)))] dark:bg-[linear-gradient(115deg,rgba(0,229,255,0.16),transparent_32rem),linear-gradient(245deg,rgba(255,106,0,0.12),transparent_30rem),linear-gradient(180deg,#0B0F14,#070b10_55%,#0B0F14)]" />
      <div className="brand-toolpath absolute inset-0 opacity-30 dark:opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
      <motion.div className="absolute left-1/2 top-24 h-px w-[70vw] -translate-x-1/2 bg-primary/30" animate={{ opacity: [0.2, 0.8, 0.2], scaleX: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 3 }} />
    </div>
  );
}

function HeroStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="cyber-surface rounded-2xl p-4">
      <p className="text-2xl font-semibold">{value}{suffix}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}

function LiveMetric({ icon: Icon, label, value, swatch }: { icon: typeof Boxes; label: string; value: string; swatch?: string }) {
  return (
    <div className="cyber-surface rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="size-4 text-primary" />
        {swatch ? <span className="size-4 rounded-full border" style={{ backgroundColor: swatch.toLowerCase() }} /> : null}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RecentPrintRow({ print }: { print: QueueState["recentPrints"][number] }) {
  const completedAt = print.completedAt ? new Date(print.completedAt) : null;

  return (
    <motion.div key={print.id} layout className="flex items-start gap-3 rounded-xl border bg-background/35 p-3 text-sm">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-200" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{print.orderNumber}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          Completed · {formatPrintDuration(print.startedAt, print.completedAt)} · {print.printer?.name ?? "Printer"}
        </span>
      </span>
      <span className="shrink-0 text-muted-foreground">
        {completedAt ? completedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "--"}
      </span>
    </motion.div>
  );
}

function formatPrintDuration(startedAt?: Date | string | null, completedAt?: Date | string | null) {
  if (!startedAt || !completedAt) return "runtime unknown";
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  const minutes = Math.max(0, Math.round((completed - started) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatLayerProgress(currentLayer?: number | null, totalLayer?: number | null, progressPercent?: number | null) {
  const layers = currentLayer != null && totalLayer != null && totalLayer > 0 ? `${currentLayer}/${totalLayer}` : "--/--";
  return `${layers} · ${Math.round(progressPercent ?? 0)}%`;
}

function formatCombinedTemps(nozzle?: number | null, nozzleTarget?: number | null, bed?: number | null, bedTarget?: number | null) {
  if (nozzle == null && bed == null) return "Waiting for printer";
  return `Nozzle ${formatTemp(nozzle, nozzleTarget)} · Bed ${formatTemp(bed, bedTarget)}`;
}

function formatTemp(current?: number | null, target?: number | null) {
  if (current == null) return "--C";
  const currentRounded = Math.round(current);
  const targetRounded = target == null ? null : Math.round(target);
  return targetRounded != null && targetRounded > 0 ? `${currentRounded}/${targetRounded}C` : `${currentRounded}C`;
}

function formatRemaining(seconds: number | null) {
  if (seconds == null) return "Waiting";
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function HowItWorks() {
  const steps = [
    [Upload, "Upload", "Send a model or pick a store part."],
    [Boxes, "Review", "We check material, scale, printability, and queue fit."],
    [Eye, "Watch", "Follow the bed feed, status, ETA, and safe telemetry."],
    [PackageCheck, "Receive", "Get a finished part with a clear production trail."]
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A clearer way to order custom prints</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {steps.map(([Icon, title, copy], index) => (
          <motion.div key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="cyber-surface rounded-2xl p-5">
            <Icon className="size-5 text-primary" />
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ProofSection() {
  const points = [
    ["Functional parts", "Brackets, mounts, adapters, fixtures, replacement pieces, prototypes, and small product runs."],
    ["Visible process", "Queue state, printer status, material context, and completion history stay available without exposing printer controls."],
    ["Less waste", "On-demand production, spool tracking, and separated scrap keep the operation lean as it grows."]
  ] as const;

  return (
    <section className="border-y bg-card/35 py-20">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="cyber-surface overflow-hidden rounded-2xl p-0">
          <img src="/assets/generated/home/finished-parts-queue.png" alt="Finished 3D printed parts on a SuperPrint inspection bench" className="aspect-video h-full w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Real output, visible steps</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built around the print you actually need.</h2>
          <p className="mt-4 text-muted-foreground">
            From small prototypes to functional replacement parts, SuperPrint keeps the job understandable while the printer does the work.
          </p>
          <div className="mt-6 grid gap-3">
            {points.map(([title, copy]) => (
              <div key={title} className="rounded-xl border bg-background/45 p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  const features = [
    ["Live queue", "See what is printing, what is next, and when work is moving."],
    ["Printer feed", "Watch the bed feed and live status without touching machine controls."],
    ["Material tracking", "Spools, colors, low-stock states, and usage are visible to the system."],
    ["Operator review", "Human checks protect quality before a print is allowed to start."],
    ["Production history", "Finished prints, failures, and events leave a trail support can read."],
    ["Timelapse ready", "Production media can become part of the customer experience."],
    ["Maintenance aware", "Printer health and maintenance tasks stay connected to queue decisions."],
    ["Upgrade goals", "Community-backed improvements show what capability comes next."],
    ["Store or custom", "Use ready products or submit your own model for review."],
    ["Sustainable loop", "Scrap separation and material accounting make waste easier to reduce."]
  ] as const;
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Why it feels different</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">A print shop you can actually follow</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {features.map(([feature, copy]) => (
            <div key={feature} className="cyber-surface group rounded-2xl p-5 transition hover:border-primary/40 hover:shadow-[0_0_44px_hsl(var(--primary)/0.14)]">
              <CircuitBoard className="size-5 text-primary" />
              <p className="mt-5 text-sm font-medium">{feature}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InventorySection({ filament }: { filament: HomepageFilament[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Live inventory</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Material stock under observation</h2>
        </div>
        <Badge className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100">Realtime remaining KG</Badge>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {filament.length ? filament.map((spool) => (
          <div key={spool.id} className="cyber-surface rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="size-5 rounded-full border" style={{ backgroundColor: spool.color.toLowerCase() }} />
              <Badge className={spool.low ? "bg-orange-500/10 text-orange-700 dark:text-orange-100" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-100"}>{spool.low ? "Low stock" : "Available"}</Badge>
            </div>
            <p className="mt-5 font-semibold">{spool.color} {spool.material}</p>
            <p className="mt-2 text-3xl font-semibold">{(spool.remainingGrams / 1000).toFixed(2)}kg</p>
            <div className="mt-4 h-2 rounded bg-muted">
              <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, Math.max(4, spool.remainingGrams / 10))}%` }} />
            </div>
          </div>
        )) : <p className="rounded-2xl border border-dashed p-6 text-muted-foreground md:col-span-4">Add filament in setup or admin to populate live inventory.</p>}
      </div>
    </section>
  );
}

function StatsSection({ stats }: { stats: HomepageStats }) {
  return (
    <section className="bg-primary py-16 text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">
        <AnimatedMetric label="completed prints" value={stats.completedPrints} suffix="+" />
        <AnimatedMetric label="runtime hours" value={stats.runtimeHours} suffix="+" />
        <AnimatedMetric label="success rate" value={stats.successRate} suffix="%" />
        <AnimatedMetric label="filament tracked" value={stats.filamentKg} suffix="kg+" />
      </div>
    </section>
  );
}

function AnimatedMetric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const steps = 24;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      setDisplay(Math.round((value * tick) / steps));
      if (tick >= steps) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [value]);
  return (
    <div>
      <p className="text-4xl font-semibold">{display}{suffix}</p>
      <p className="mt-1 text-sm uppercase tracking-[0.22em] text-primary-foreground/75">{label}</p>
    </div>
  );
}

function UpgradePreviewSection() {
  const items = [
    [Camera, "Better live views", "Cleaner camera angles, lighting, and media for print progress."],
    [Boxes, "More materials", "New filament colors and specialty materials as demand grows."],
    [Gauge, "Faster throughput", "Queue tuning, repeatable profiles, and added printer capacity."],
    [Recycle, "Recycling loop", "Better scrap tracking, refill spool workflows, and material recovery."],
    [Timer, "Shorter waits", "Reserved windows and clearer ETAs without turning the queue unfair."],
    [Leaf, "Lower waste", "More sustainable packaging, waste reporting, and smarter reprint prevention."]
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.28em] text-secondary">What gets better next</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">Every upgrade should make ordering easier.</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The factory evolution system is about practical improvements customers can feel: better visibility, more material options, cleaner handoff, and less waste.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map(([Icon, item, copy]) => (
          <div key={item} className="cyber-surface rounded-2xl p-5">
            <Icon className="size-5 text-secondary" />
            <p className="mt-4 font-medium">{item}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="cyber-surface mx-auto max-w-7xl rounded-[2rem] p-8 text-center md:p-14">
        <Video className="mx-auto size-8 text-primary" />
        <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">Ready to see your print move?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Start with a model, join the queue, and watch SuperPrint turn it into a real part.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="h-12 px-5"><Link href="/upload">Upload a Model</Link></Button>
          <Button asChild variant="outline" className="h-12 px-5 bg-card/50"><Link href="/queue">Join the Queue</Link></Button>
        </div>
      </div>
      <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl border bg-background/90 p-2 shadow-2xl backdrop-blur md:hidden">
        <Button asChild className="flex-1"><Link href="/upload">Start</Link></Button>
        <Button asChild variant="outline" className="flex-1 bg-card/50"><Link href="/queue">Live</Link></Button>
      </div>
    </section>
  );
}
