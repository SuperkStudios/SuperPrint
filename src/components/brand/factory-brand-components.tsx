import { Activity, Box, CheckCircle2, Factory, Gauge, Hexagon, Radio, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type FactoryStat = {
  id: string;
  label: string;
  value: string;
  unit?: string | null;
  icon: string;
  description?: string | null;
};

type FactoryGoal = {
  title: string;
  category: string;
  status: string;
  progressPercent: number;
};

type SupporterTier = {
  id: string;
  title: string;
  badgeIcon: string;
  badgeColor: string;
  perks: string[];
};

export function ManufacturingBrandHero() {
  return (
    <div className="cyber-surface relative min-h-[28rem] overflow-hidden rounded-2xl">
      <div className="brand-toolpath absolute inset-0 opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,hsl(var(--primary)/0.24),transparent_28%),linear-gradient(180deg,transparent,hsl(var(--background)/0.72))]" />
      <div className="absolute left-8 top-6 z-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
        <span className="size-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary))]" />
        Live factory cell
      </div>

      <div className="absolute inset-x-10 bottom-12 h-44 rounded-[2rem] border border-primary/30 bg-background/35 [transform:perspective(700px)_rotateX(62deg)]">
        <div className="factory-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-x-8 top-1/2 h-px bg-primary/70 shadow-[0_0_18px_hsl(var(--primary))]" />
        <div className="absolute inset-y-8 left-1/2 w-px bg-primary/70 shadow-[0_0_18px_hsl(var(--primary))]" />
      </div>

      <div className="absolute left-1/2 top-8 h-48 w-28 -translate-x-1/2 rounded-b-3xl border border-primary/25 bg-gradient-to-b from-slate-800 to-black shadow-[0_0_40px_hsl(var(--primary)/0.18)]">
        <div className="mx-auto mt-8 h-24 w-16 rounded-b-2xl border border-border bg-card" />
        <div className="mx-auto h-10 w-8 bg-gradient-to-b from-primary to-secondary [clip-path:polygon(20%_0,80%_0,62%_100%,38%_100%)]" />
      </div>

      <div className="absolute bottom-24 left-1/2 h-28 w-72 -translate-x-1/2 rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-background shadow-[0_22px_60px_hsl(var(--primary)/0.18)] [transform:skewX(-16deg)]">
        <div className="absolute inset-4 rounded-xl border border-primary/20" />
        <div className="absolute left-12 top-9 h-10 w-48 rounded-full border-4 border-primary/70" />
        <div className="absolute bottom-5 left-8 h-3 w-56 rounded bg-secondary/80" />
      </div>

      <div className="absolute inset-x-6 bottom-5 z-10 grid gap-2 text-xs sm:grid-cols-4">
        <WorkflowStep icon={Upload} title="Upload" copy="Submit model" />
        <WorkflowStep icon={Box} title="Queue" copy="Live fabrication" />
        <WorkflowStep icon={Radio} title="Watch" copy="Telemetry feed" />
        <WorkflowStep icon={Hexagon} title="Unlock" copy="Factory upgrades" />
      </div>
    </div>
  );
}

export function LiveFactoryConsole({ stats, goal }: { stats: FactoryStat[]; goal?: FactoryGoal }) {
  const primaryStats = stats.slice(0, 4);

  return (
    <div className="cyber-surface relative min-h-[28rem] overflow-hidden rounded-2xl p-5">
      <div className="brand-toolpath absolute inset-0 opacity-20" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Live factory</p>
          <h3 className="mt-2 text-2xl font-semibold">Operations Console</h3>
        </div>
        <Badge className="border-accent/40 bg-accent/10 text-accent">Online</Badge>
      </div>

      <div className="relative mt-5 rounded-xl border bg-background/45 p-3">
        <div className="aspect-video overflow-hidden rounded-lg border bg-card">
          <div className="brand-toolpath h-full opacity-55" />
        </div>
        <div className="mt-3 grid gap-2">
          {(goal ? [goal] : []).map((item) => (
            <div key={item.title} className="rounded-lg border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{item.title}</span>
                <span className="text-primary">{item.progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-muted">
                <div className="h-2 rounded bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.55)]" style={{ width: `${item.progressPercent}%` }} />
              </div>
            </div>
          ))}
          {!goal ? <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Upgrade progress appears when a goal is active.</div> : null}
        </div>
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        {primaryStats.map((stat) => (
          <div key={stat.id} className="rounded-lg border bg-card/55 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold">{stat.value}{stat.unit ?? ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FactoryStatTile({ stat }: { stat: FactoryStat }) {
  return (
    <div className="cyber-surface rounded-lg bg-background/60 p-5">
      <div className="flex items-center justify-between">
        <FactoryIcon icon={stat.icon} />
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-primary/60" />
      </div>
      <p className="mt-4 text-2xl font-semibold">{stat.value}{stat.unit ?? ""}</p>
      <p className="text-sm text-muted-foreground">{stat.label}</p>
    </div>
  );
}

export function SupporterBadgeShowcase({ tiers }: { tiers: SupporterTier[] }) {
  const fallback = [
    { id: "pioneer", title: "Pioneer", badgeIcon: "SP", badgeColor: "#00E5FF", perks: ["Early supporter"] },
    { id: "builder", title: "Builder", badgeIcon: "SP", badgeColor: "#FF6A00", perks: ["Factory backer"] },
    { id: "engineer", title: "Engineer", badgeIcon: "SP", badgeColor: "#8B5CF6", perks: ["Core contributor"] }
  ];
  const shown = (tiers.length ? tiers : fallback).slice(0, 3);

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      {shown.map((tier, index) => (
        <div key={tier.id} className="relative flex justify-center py-2">
          <div
            className="relative h-44 w-52 p-px"
            style={{
              clipPath: "polygon(50% 0, 94% 24%, 94% 76%, 50% 100%, 6% 76%, 6% 24%)",
              background: `linear-gradient(135deg, ${tier.badgeColor}, transparent 52%, ${tier.badgeColor})`,
              filter: `drop-shadow(0 0 22px ${tier.badgeColor}40)`
            }}
          >
            <div
              className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#070b10] px-5 text-center"
              style={{ clipPath: "polygon(50% 1.5%, 92.5% 25%, 92.5% 75%, 50% 98.5%, 7.5% 75%, 7.5% 25%)" }}
            >
              <div className="brand-toolpath absolute inset-0 opacity-20" />
              <div className="absolute inset-x-8 top-8 h-px" style={{ background: tier.badgeColor }} />
              <img src="/brand/superprint-mark-64.png" alt="" className="relative h-9 w-9 object-contain" />
              <p className="relative mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-zinc-300">Supporter</p>
              <p className="relative mt-1 text-2xl font-semibold uppercase tracking-[0.2em]" style={{ color: tier.badgeColor }}>
                {tier.title}
              </p>
              <p className="relative mt-2 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-400">{tier.perks[0] ?? "Factory supporter"}</p>
              <div className="relative mt-3 flex gap-1.5 text-sm" style={{ color: tier.badgeColor }}>
                {Array.from({ length: index + 1 }).map((_, star) => <span key={star}>★</span>)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowStep({ icon: Icon, title, copy }: { icon: typeof Upload; title: string; copy: string }) {
  return (
    <div className="rounded-lg border bg-background/55 p-3 backdrop-blur">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 font-medium">{title}</p>
      <p className="text-muted-foreground">{copy}</p>
    </div>
  );
}

function FactoryIcon({ icon }: { icon: string }) {
  const icons = { factory: Factory, circuit: Activity, shield: ShieldCheck, activity: Activity, gauge: Gauge, boxes: Box, sparkles: CheckCircle2, wrench: Gauge };
  const Icon = icons[icon as keyof typeof icons] ?? Gauge;
  return <Icon className="size-5 text-primary" />;
}
