"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, Camera, CircuitBoard, Clock, Cpu, Eye, Factory, Gauge, Layers3, PackageCheck, Radio, ShieldCheck, Sparkles, Upload, Video } from "lucide-react";
import { LiveBedFeed } from "@/components/live/live-bed-feed";
import { TelemetryDashboard } from "@/components/live/telemetry-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveManufacturing } from "@/hooks/use-live-manufacturing";

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
  filament
}: {
  queue: QueueState;
  events: PublicEvent[];
  stats: HomepageStats;
  filament: HomepageFilament[];
}) {
  const live = useLiveManufacturing(events);
  const current = queue.current;
  const printerName = current?.printer?.name ?? queue.printers[0]?.name ?? "SuperPrint cell";
  const currentPrint = current?.orderNumber ?? "Awaiting next approved job";

  return (
    <main className="overflow-hidden bg-[#03050a] text-white">
      <section className="relative min-h-screen">
        <CyberBackground />
        <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">Transparent live manufacturing</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-7xl lg:text-8xl">
              Real-Time 3D Manufacturing
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              Upload models, join the live queue, and watch production happen in real time on SuperPrint.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild className="h-12 px-5 bg-cyan-300 text-zinc-950 hover:bg-cyan-200">
                <Link href="/upload">Start Printing <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-5 border-white/20 bg-white/5 text-white hover:bg-white/10">
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
            <div className="absolute -inset-10 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-cyan-950/60 backdrop-blur-xl">
              <TelemetryDashboard queue={queue} />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-zinc-950/90 py-16 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.08),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-5 flex items-center gap-3">
              <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
              <span className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-200">Live factory</span>
            </div>
            <LiveBedFeed printerName={printerName} currentPrint={currentPrint} />
          </div>
          <div>
            <TelemetryDashboard queue={queue} />
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-5">
              <h3 className="font-semibold">Recent live events</h3>
              <div className="mt-4 space-y-3">
                {(live.events.length ? live.events : events).slice(0, 5).map((event) => (
                  <motion.div key={event.id} layout className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                    <Sparkles className="size-4 text-orange-200" />
                    <span>{event.type.replaceAll("_", " ")}</span>
                    <span className="ml-auto text-zinc-500">{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </motion.div>
                ))}
                {!events.length ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">Events will appear as production moves.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />
      <FeatureGrid />
      <InventorySection filament={filament} />
      <StatsSection stats={stats} />
      <RoadmapSection />
      <FinalCta />
    </main>
  );
}

function CyberBackground() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#020617,#03050a_55%,#070b12)]" />
      <div className="factory-grid absolute inset-0 opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#03050a] to-transparent" />
      <motion.div className="absolute left-1/2 top-24 h-px w-[70vw] -translate-x-1/2 bg-cyan-200/30" animate={{ opacity: [0.2, 0.8, 0.2], scaleX: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 3 }} />
    </div>
  );
}

function HeroStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
      <p className="text-2xl font-semibold text-white">{value}{suffix}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    [Upload, "Upload", "Submit approved products or custom STL files."],
    [Boxes, "Queue", "Operator review moves printable work into the live queue."],
    [Eye, "Watch Live", "Follow the bed feed, status, ETA, and safe telemetry."],
    [PackageCheck, "Delivered", "Receive the print and downloadable production media."]
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Upload → Queue → Watch Live → Delivered</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {steps.map(([Icon, title, copy], index) => (
          <motion.div key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
            <Icon className="size-5 text-cyan-200" />
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{copy}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  const features = ["Live Queue Tracking", "Transparent Manufacturing", "STL Upload System", "Real-Time Telemetry", "Smart Queue Scheduling", "Verified Print Profiles", "Filament Tracking", "Automated Monitoring", "Timelapse Recording", "Maintenance Tracking"];
  return (
    <section className="border-y border-white/10 bg-white/[0.03] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">Infrastructure-grade manufacturing software</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {features.map((feature) => (
            <div key={feature} className="group rounded-2xl border border-white/10 bg-zinc-950/70 p-5 transition hover:border-cyan-300/40 hover:shadow-[0_0_44px_rgba(34,211,238,0.14)]">
              <CircuitBoard className="size-5 text-cyan-200" />
              <p className="mt-5 text-sm font-medium">{feature}</p>
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
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-200">Live inventory</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Material stock under observation</h2>
        </div>
        <Badge className="w-fit border-emerald-300/30 bg-emerald-300/10 text-emerald-100">Realtime remaining KG</Badge>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {filament.length ? filament.map((spool) => (
          <div key={spool.id} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-center justify-between">
              <span className="size-5 rounded-full border border-white/20" style={{ backgroundColor: spool.color.toLowerCase() }} />
              <Badge className={spool.low ? "bg-orange-300/10 text-orange-100" : "bg-emerald-300/10 text-emerald-100"}>{spool.low ? "Low stock" : "Available"}</Badge>
            </div>
            <p className="mt-5 font-semibold">{spool.color} {spool.material}</p>
            <p className="mt-2 text-3xl font-semibold">{(spool.remainingGrams / 1000).toFixed(2)}kg</p>
            <div className="mt-4 h-2 rounded bg-white/10">
              <div className="h-2 rounded bg-cyan-300" style={{ width: `${Math.min(100, Math.max(4, spool.remainingGrams / 10))}%` }} />
            </div>
          </div>
        )) : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-zinc-400 md:col-span-4">Add filament in setup or admin to populate live inventory.</p>}
      </div>
    </section>
  );
}

function StatsSection({ stats }: { stats: HomepageStats }) {
  return (
    <section className="bg-cyan-300 py-16 text-zinc-950">
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
      <p className="mt-1 text-sm uppercase tracking-[0.22em] text-zinc-700">{label}</p>
    </div>
  );
}

function RoadmapSection() {
  const items = ["Multi-printer support", "Multi-color printing", "Distributed print nodes", "AI failure detection", "Automated print farms", "Smart maintenance"];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.28em] text-orange-200">Future network</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">A live manufacturing platform</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
            <Factory className="size-5 text-orange-200" />
            <p className="mt-4 font-medium">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur md:p-14">
        <Video className="mx-auto size-8 text-cyan-200" />
        <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">Manufacturing should be transparent.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="h-12 px-5 bg-cyan-300 text-zinc-950 hover:bg-cyan-200"><Link href="/upload">Upload a Model</Link></Button>
          <Button asChild variant="outline" className="h-12 px-5 border-white/20 bg-white/5 text-white hover:bg-white/10"><Link href="/queue">Join the Queue</Link></Button>
        </div>
      </div>
      <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-2xl backdrop-blur md:hidden">
        <Button asChild className="flex-1 bg-cyan-300 text-zinc-950"><Link href="/upload">Start</Link></Button>
        <Button asChild variant="outline" className="flex-1 border-white/20 bg-white/5 text-white"><Link href="/queue">Live</Link></Button>
      </div>
    </section>
  );
}
