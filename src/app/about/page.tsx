import { ArrowRight, Headphones, Leaf, Recycle, ShieldCheck, Video, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CyberCard, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { Button } from "@/components/ui/button";
import { getBootstrapStatus } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const pillars = [
    {
      icon: Video,
      title: "Observable by default",
      copy: "Customers can watch the live queue, active printer state, safe telemetry, and finished production media without exposing internal printer controls."
    },
    {
      icon: ShieldCheck,
      title: "Operator-gated safety",
      copy: "Print starts, failures, maintenance, materials, and queue changes stay behind admin controls with audit events for every transition."
    },
    {
      icon: Recycle,
      title: "Sustainable local production",
      copy: "We track material use, recycle scrap whenever possible, minimize failed runs, and prefer local fabrication over wasteful overproduction."
    },
    {
      icon: Headphones,
      title: "24/7 support mindset",
      copy: "SuperPrint is built as a transparent operating system: customers can see status anytime, and support can trace what happened from upload to delivery."
    }
  ];

  return (
    <PageShell>
      <PageSection className="grid gap-8">
        <PageHero
          eyebrow="About SuperPrint"
          title="A live operating system for transparent fabrication."
          copy="SuperPrint turns 3D printing into observable manufacturing. Instead of sending an order into a black box, customers can upload, queue, watch, receive, and revisit the finished production media."
        >
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link href="/queue">Watch live <ArrowRight className="size-4" /></Link></Button>
            <Button asChild variant="outline"><Link href="/upload">Upload a model</Link></Button>
          </div>
        </PageHero>

        <div className="grid gap-4 md:grid-cols-4">
          {pillars.map(({ icon: Icon, title, copy }) => (
            <CyberCard key={title}>
              <Icon className="size-5 text-primary" />
              <h2 className="mt-5 font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
            </CyberCard>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <CyberCard className="overflow-hidden p-0">
            <div className="factory-grid min-h-[360px] bg-zinc-950 p-6 text-white">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">LIVE SYSTEM</span>
                <span className="text-xs uppercase tracking-[0.22em] text-cyan-200">Queue visible</span>
              </div>
              <div className="mt-16 rounded-2xl border border-cyan-200/20 bg-white/[0.06] p-5 shadow-[0_0_80px_rgba(34,211,238,0.14)]">
                <Zap className="size-5 text-cyan-200" />
                <p className="mt-5 text-2xl font-semibold">Transparency is the product.</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  The live queue, health summaries, ETA, material tracking, and media receipts make production legible without making operations vulnerable.
                </p>
              </div>
            </div>
          </CyberCard>
          <CyberCard>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Sustainability loop</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Less guessing, less waste.</h2>
            <div className="mt-6 grid gap-4">
              {[
                ["Track every spool", "Material starts at stock intake and moves through assignments, usage, low-stock thresholds, and job history."],
                ["Recycle what we can", "Scrap, purge, supports, and test material are separated where possible so waste becomes accountable instead of invisible."],
                ["Print on demand", "Products are made when ordered, not warehoused in piles that may never ship."]
              ].map(([title, copy]) => (
                <div key={title} className="rounded-xl border bg-background/35 p-4">
                  <div className="flex items-center gap-3">
                    <Leaf className="size-4 text-emerald-500" />
                    <h3 className="font-medium">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </CyberCard>
        </div>
      </PageSection>
    </PageShell>
  );
}
