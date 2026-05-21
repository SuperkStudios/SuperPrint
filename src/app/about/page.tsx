import {
  ArrowRight,
  BadgeCheck,
  Box,
  Camera,
  Gauge,
  Leaf,
  PackageCheck,
  Radio,
  Recycle,
  ShieldCheck,
  Sparkles,
  Timer
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CyberCard, PageSection, PageShell } from "@/components/cyber-page";
import { Button } from "@/components/ui/button";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const heroImage = "/assets/generated/about/printer-cell-hero.png";
const recycleImage = "/assets/generated/about/recycling-loop.png";
const qualityImage = "/assets/generated/about/quality-bench.png";

export default async function AboutPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const [printers, filamentCount, completedPrints] = await Promise.all([
    prisma.printer.findMany({ include: { currentFilament: true }, orderBy: { publicName: "asc" } }),
    prisma.filamentSpool.count(),
    prisma.printJob.count({ where: { status: "COMPLETED" } })
  ]);

  const primaryPrinter = printers[0];
  const printerName = primaryPrinter?.publicName ?? "Centauri Carbon 1";
  const printerModel = primaryPrinter?.modelName ?? "Elegoo Centauri Carbon";
  const buildVolume = primaryPrinter
    ? `${primaryPrinter.buildVolumeXmm} x ${primaryPrinter.buildVolumeYmm} x ${primaryPrinter.buildVolumeZmm} mm`
    : "256 x 256 x 256 mm";
  const nozzle = primaryPrinter ? `${primaryPrinter.nozzleSizeMm.toFixed(1)} mm nozzle` : "0.4 mm nozzle";
  const materials = parseMaterials(primaryPrinter?.supportedMaterials);
  const printerStatus = primaryPrinter?.status ?? "READY";

  const printerSpecs = [
    { icon: Box, label: "Build volume", value: buildVolume },
    { icon: Gauge, label: "Print setup", value: nozzle },
    { icon: Sparkles, label: "Materials", value: materials.join(", ") },
    { icon: Radio, label: "Live visibility", value: primaryPrinter?.cameraSource ? "Camera-enabled" : "Queue telemetry" }
  ];

  const reasons = [
    {
      icon: Camera,
      title: "You can see the work",
      copy: "Orders move through a public live queue with status, safe telemetry, and production context instead of disappearing into a black box."
    },
    {
      icon: ShieldCheck,
      title: "Operator-gated quality",
      copy: "Print starts, failures, material changes, and completion steps stay behind operator controls with event history for accountability."
    },
    {
      icon: Timer,
      title: "Built for fast iteration",
      copy: "Small parts, prototypes, replacement brackets, cosplay details, and product tests can be queued without waiting on mass-production tooling."
    },
    {
      icon: PackageCheck,
      title: "Made on demand",
      copy: "We print what is actually ordered, then track the job through fulfillment so waste and confusion stay low."
    }
  ];

  const sustainability = [
    "Scrap, purge material, supports, and failed-test pieces are separated so recycling becomes part of the process.",
    "Material usage is tracked against real spools, which helps us reduce surprises, bad runs, and unnecessary reprints.",
    "On-demand local production avoids shelves of unsold inventory and keeps the operation lean.",
    "Future upgrades are designed around recycled filament, refill spools, waste reporting, and better material recovery."
  ];

  return (
    <PageShell className="overflow-hidden">
      <PageSection className="grid gap-14">
        <section className="relative overflow-hidden rounded-2xl border bg-card/50">
          <img src={heroImage} alt={`${printerModel} printing inside the SuperPrint live factory cell`} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.92)_28%,hsl(var(--background)/0.52)_58%,transparent_100%)]" />
          <div className="brand-toolpath absolute inset-0 opacity-20" />
          <div className="relative max-w-3xl px-6 py-16 sm:px-8 lg:px-10 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">About SuperPrint</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Live 3D printing, built to be seen.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              SuperPrint is a transparent fabrication shop powered by a live printer cell, real queue telemetry, and a sustainability loop that treats material as infrastructure, not disposable clutter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild><Link href="/upload">Start a print <ArrowRight className="size-4" /></Link></Button>
              <Button asChild variant="outline"><Link href="/queue">Watch the live queue</Link></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Our printer</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{printerName}</h2>
            <p className="mt-4 text-muted-foreground">{printerModel} is the current production cell behind SuperPrint. It is set up for practical customer parts, repeatable queue operation, and visible production from upload to handoff.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {printerSpecs.map(({ icon: Icon, label, value }) => (
                <CyberCard key={label} className="rounded-xl p-4">
                  <Icon className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </CyberCard>
              ))}
            </div>
          </div>
          <CyberCard className="overflow-hidden p-0">
            <img src={qualityImage} alt="Inspected 3D printed parts, material samples, and calibration tools" className="aspect-video w-full object-cover" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <StatusTile label="Printer status" value={printerStatus.replaceAll("_", " ")} />
              <StatusTile label="Tracked spools" value={filamentCount} />
              <StatusTile label="Completed prints" value={completedPrints} />
            </div>
          </CyberCard>
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Why choose us</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Not just a print button. A visible production system.</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {reasons.map(({ icon: Icon, title, copy }) => (
              <CyberCard key={title}>
                <Icon className="size-5 text-primary" />
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
              </CyberCard>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <CyberCard className="overflow-hidden p-0">
            <img src={recycleImage} alt="Sorted 3D printing scrap, filament spools, and recycling workflow" className="aspect-video w-full object-cover" />
          </CyberCard>
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                <Recycle className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Sustainable by operation</p>
                <h2 className="text-3xl font-semibold tracking-tight">Recycle, track, improve.</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {sustainability.map((item) => (
                <div key={item} className="rounded-xl border bg-card/45 p-4">
                  <div className="flex gap-3">
                    <Leaf className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Upload", "Send a model or choose a store part. We keep the intake clear so the print can be reviewed before production."],
            ["Queue", "Approved jobs enter a visible queue with status, material context, and operator-gated production steps."],
            ["Receive", "You get a real manufactured part, with the story of how it moved through the factory instead of a mystery box."]
          ].map(([title, copy], index) => (
            <CyberCard key={title}>
              <div className="flex items-center justify-between">
                <BadgeCheck className="size-5 text-primary" />
                <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
            </CyberCard>
          ))}
        </section>
      </PageSection>
    </PageShell>
  );
}

function StatusTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background/45 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function parseMaterials(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return ["PLA", "PETG"];
}
