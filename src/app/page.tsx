import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Box,
  Boxes,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Cpu,
  Github,
  Layers3,
  Play,
  Radio,
  ScanLine,
  Server,
  Settings2,
  ShieldCheck,
  Waypoints
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const workflow = [
  {
    number: "01",
    title: "Prepare",
    body: "Bring STL and 3MF models into a 3D review workflow before they reach a machine.",
    icon: Box
  },
  {
    number: "02",
    title: "Slice",
    body: "Generate print-ready G-code locally with OrcaSlicer machine, filament, and process profiles.",
    icon: Layers3
  },
  {
    number: "03",
    title: "Dispatch",
    body: "Move approved jobs through SuperNode without exposing printer credentials outside the local network.",
    icon: Waypoints
  },
  {
    number: "04",
    title: "Observe",
    body: "Follow queue state, telemetry, camera media, filament, failures, and maintenance in one operating loop.",
    icon: Activity
  }
];

const currentPaths = [
  "Elegoo Centauri Carbon control through SDCP",
  "Generic G-code with operator-gated manual dispatch",
  "Local OrcaSlicer CLI profiles",
  "SuperNode heartbeat, media, and queue handoff"
];

const plannedAdapters = ["Bambu Lab", "Prusa", "Creality", "Klipper", "Moonraker", "OctoPrint", "Voron", "RatRig"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070a0f] text-slate-100">
      <header className="relative z-20 border-b border-white/10 bg-[#070a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SuperPrint OS home">
            <span className="grid size-9 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-300">
              <Boxes className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-[0.16em]">SUPERPRINT</span>
              <span className="block text-[0.62rem] font-medium uppercase tracking-[0.28em] text-slate-500">Fabrication OS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex" aria-label="Primary navigation">
            <Link className="transition hover:text-white" href="#workflow">Workflow</Link>
            <Link className="transition hover:text-white" href="#connectivity">Connectivity</Link>
            <a
              className="transition hover:text-white"
              href="https://github.com/SuperkStudios/PrintNow"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
          </nav>

          <Link
            href="/operator"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            Open console
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <section className="relative border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_40%,rgba(34,211,238,0.13),transparent_33%),radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.08),transparent_25%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.13)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

        <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
              <CircleDot className="size-3.5" />
              Built in public
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl">
              One workflow from <span className="text-cyan-300">mesh</span> to machine.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
              SuperPrint OS connects model preparation, local slicing, safe printer dispatch, and live production signals in a
              hardware-agnostic manufacturing layer you can run yourself.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/operator"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                <Play className="size-4 fill-current" />
                Launch operator console
              </Link>
              <Link
                href="#workflow"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              >
                Explore the pipeline
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
              <HeroMetric label="Slicer" value="Orca CLI" />
              <HeroMetric label="Local agent" value="SuperNode" />
              <HeroMetric label="Control" value="Opt-in" />
            </div>
          </div>

          <div className="relative lg:pl-6">
            <div className="absolute -inset-10 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0b111a] shadow-2xl shadow-cyan-950/40">
              <div className="flex h-11 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-red-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-300/70" />
                  <span className="size-2.5 rounded-full bg-emerald-300/70" />
                </div>
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">3D workflow preview</span>
                <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-300">
                  <Radio className="size-3" /> local-first
                </span>
              </div>

              <div className="grid min-h-[470px] grid-cols-[56px_1fr] sm:grid-cols-[72px_1fr]">
                <aside className="flex flex-col items-center gap-3 border-r border-white/10 bg-white/[0.02] py-5" aria-label="Workspace tools">
                  <ToolIcon icon={Box} active label="Model" />
                  <ToolIcon icon={ScanLine} label="Slice" />
                  <ToolIcon icon={Server} label="Printers" />
                  <ToolIcon icon={Activity} label="Monitor" />
                  <ToolIcon icon={Settings2} label="Settings" />
                </aside>

                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-sm font-semibold text-white">Production cell</p>
                      <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Preview · Slice · Dispatch</p>
                    </div>
                    <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                      Operator gated
                    </span>
                  </div>

                  <div className="relative flex-1 overflow-hidden bg-[#090e15]">
                    <Image
                      src="/assets/generated/about/printer-cell-hero.png"
                      alt="3D printer producing a part in a fabrication workspace"
                      fill
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090e15] via-transparent to-[#090e15]/30" />
                    <div className="absolute left-4 top-4 rounded-lg border border-white/15 bg-slate-950/75 p-3 backdrop-blur sm:left-5 sm:top-5">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-300">Model → toolpath</p>
                      <p className="mt-2 text-sm font-semibold text-white">Local slice pipeline</p>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:bottom-5 sm:left-5 sm:right-5 sm:grid-cols-3">
                      <WorkspaceSignal icon={Cpu} label="Adapter boundary" value="Protocol isolated" />
                      <WorkspaceSignal icon={Layers3} label="Local slicing" value="Orca profiles" />
                      <WorkspaceSignal icon={ShieldCheck} label="Operator control" value="Explicit starts" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-16 border-b border-white/10 bg-[#090d13] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionIntro
            eyebrow="The production loop"
            title="A slicer is only useful when the whole handoff works."
            body="SuperPrint keeps model review, slicer output, printer readiness, operator safety, and production evidence in the same workflow."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step) => (
              <article key={step.number} className="group bg-[#0b1018] p-6 transition hover:bg-[#0e1620] sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-600">{step.number}</span>
                  <step.icon className="size-5 text-cyan-300" />
                </div>
                <h2 className="mt-12 text-xl font-semibold text-white">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="connectivity" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionIntro
            eyebrow="Hardware without the hype"
            title="Connect through adapters. Keep support claims honest."
            body="The core workflow is hardware-agnostic, while every real printer protocol remains isolated and testable behind an adapter boundary."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Available paths</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">In the repository today</h2>
                </div>
                <Check className="size-7 text-emerald-300" />
              </div>
              <ul className="mt-8 grid gap-4">
                {currentPaths.map((path) => (
                  <li key={path} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300" />
                    {path}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Adapter roadmap</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Designed to expand</h2>
                </div>
                <Braces className="size-7 text-cyan-300" />
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-400">
                These ecosystems are named integration targets, not claims of completed hardware support.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {plannedAdapters.map((adapter) => (
                  <span key={adapter} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                    {adapter}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8 lg:flex-row lg:items-center">
            <div className="flex max-w-3xl items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-400/10 text-orange-300">
                <Github className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">Built in public, made to run locally.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Start the app, database, queue, slicer worker, and optional printer agent with the repository&apos;s Docker workflow.
                </p>
              </div>
            </div>
            <a
              href="https://github.com/SuperkStudios/PrintNow"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View the source
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#05080c]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>SuperPrint OS · Observable manufacturing infrastructure</p>
          <div className="flex items-center gap-5">
            <Link className="transition hover:text-slate-200" href="/operator">Operator console</Link>
            <a className="transition hover:text-slate-200" href="https://github.com/SuperkStudios/PrintNow" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0b1018] px-4 py-3.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function ToolIcon({ icon: Icon, active = false, label }: { icon: LucideIcon; active?: boolean; label: string }) {
  return (
    <span
      title={label}
      className={`grid size-9 place-items-center rounded-lg border ${active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-300" : "border-transparent text-slate-600"}`}
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function WorkspaceSignal({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="hidden rounded-lg border border-white/10 bg-slate-950/80 p-3 backdrop-blur sm:block">
      <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Icon className="size-3 text-cyan-300" />
        {label}
      </div>
      <p className="mt-1.5 text-xs font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-white sm:text-5xl">{title}</h2>
      <p className="mt-5 text-base leading-7 text-slate-400">{body}</p>
    </div>
  );
}
