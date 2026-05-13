import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("app-shell px-4 py-12 sm:px-6 lg:px-8", className)}>{children}</main>;
}

export function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-7xl", className)}>{children}</section>;
}

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
  className
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card/70 p-6 shadow-2xl shadow-primary/5 backdrop-blur md:p-8", className)}>
      <div className="factory-grid absolute inset-0 opacity-[0.07]" />
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{copy}</p>
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </div>
  );
}

export function CyberCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("cyber-surface rounded-2xl p-5", className)}>{children}</div>;
}

export function MetricTile({ label, value, copy }: { label: string; value: string | number; copy?: string }) {
  return (
    <CyberCard>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      {copy ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p> : null}
    </CyberCard>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/45 p-6 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-2 leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}
