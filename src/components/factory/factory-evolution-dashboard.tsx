import Link from "next/link";
import type React from "react";
import { BadgeCheck } from "lucide-react";
import { FactoryStatTile, SupporterBadgeShowcase } from "@/components/brand/factory-brand-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FactoryContributionPanel } from "@/components/factory/factory-contribution-panel";
import { SupporterTierButton } from "@/components/factory/supporter-tier-button";
import { money } from "@/lib/utils";
import type { getPublicFactoryEvolution } from "@/services/factory-evolution";

type FactoryEvolution = Awaited<ReturnType<typeof getPublicFactoryEvolution>>;

export function FactoryEvolutionDashboard({ data, compact = false }: { data: FactoryEvolution; compact?: boolean }) {
  const featuredGoal = data.goals.find((goal) => goal.featured) ?? data.goals[0];

  return (
    <section className={compact ? "border-y bg-card/35 py-16" : "app-shell min-h-screen py-16"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <Badge className="border-primary/30 bg-primary/10 text-primary">Community-powered manufacturing infrastructure</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Every Order Upgrades The Factory</h1>
            <p className="mt-4 max-w-3xl text-muted-foreground">
              Track live factory capacity, back community goals, and watch SuperPrint unlock new production capability over time.
            </p>
          </div>
          {!compact ? <Button asChild><Link href="/upload">Start a Print</Link></Button> : <Button asChild variant="outline"><Link href="/factory">Open Dashboard</Link></Button>}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.stats.length ? data.stats.map((stat) => (
            <FactoryStatTile key={stat.id} stat={stat} />
          )) : (
            <Empty className="lg:col-span-4" label="Live factory stats will appear once printer and queue data exists." />
          )}
        </div>

        {featuredGoal ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden bg-background/70">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{featuredGoal.category}</Badge>
                  <Badge className="bg-background/40 text-muted-foreground">{featuredGoal.status}</Badge>
                </div>
                <CardTitle className="text-2xl">{featuredGoal.title}</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">{featuredGoal.description}</p>
              </CardHeader>
              <CardContent>
                <Progress current={featuredGoal.currentAmountCents} target={featuredGoal.targetAmountCents} percent={featuredGoal.progressPercent} />
                <div className="mt-5 grid gap-2">
                  <p className="text-sm font-medium">Unlocks</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {featuredGoal.unlockBenefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 rounded-md border bg-card/45 p-3 text-sm">
                        <BadgeCheck className="size-4 text-primary" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/70">
              <CardHeader>
                <CardTitle>Back this unlock</CardTitle>
                <p className="text-sm text-muted-foreground">Supporters receive recognition and platform perks. No equity, profit sharing, or payout is offered.</p>
              </CardHeader>
              <CardContent>
                <FactoryContributionPanel goalId={featuredGoal.id} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card className="bg-background/70">
            <CardHeader><CardTitle>Upgrade Goals</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {data.goals.filter((goal) => goal.id !== featuredGoal?.id).slice(0, compact ? 3 : 8).map((goal) => (
                <div key={goal.id} className="rounded-lg border bg-card/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{goal.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>
                    </div>
                    <Badge className="bg-background/40 text-muted-foreground">{goal.status}</Badge>
                  </div>
                  <div className="mt-4"><Progress current={goal.currentAmountCents} target={goal.targetAmountCents} percent={goal.progressPercent} small /></div>
                </div>
              ))}
              {!data.goals.length ? <Empty label="No public upgrade goals are configured yet." /> : null}
            </CardContent>
          </Card>

          <Card className="bg-background/70">
            <CardHeader><CardTitle>Live Activity</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {data.activity.slice(0, compact ? 5 : 10).map((event) => (
                <div key={event.id} className="rounded-md border bg-card/35 p-3 text-sm">
                  <p className="font-medium">{event.title}</p>
                  {event.body ? <p className="mt-1 text-muted-foreground">{event.body}</p> : null}
                </div>
              ))}
              {!data.activity.length ? <Empty label="Factory activity will appear here." /> : null}
            </CardContent>
          </Card>
        </div>

        {!compact ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Panel title="Recently Unlocked">
              {data.unlockedUpgrades.map((upgrade) => (
                <div key={upgrade.id} className="rounded-md border p-3 text-sm">
                  <Badge className="bg-background/40 text-muted-foreground">{upgrade.category}</Badge>
                  <p className="mt-3 font-medium">{upgrade.title}</p>
                  <p className="mt-1 text-muted-foreground">{upgrade.description}</p>
                </div>
              ))}
              {!data.unlockedUpgrades.length ? <Empty label="Completed unlocks will appear here." /> : null}
            </Panel>
            <Panel title="Community Milestones">
              {data.milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{milestone.title}</p>
                    <span className="text-muted-foreground">{milestone.currentValue}/{milestone.targetValue}{milestone.unitLabel}</span>
                  </div>
                  <div className="mt-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${milestone.progressPercent}%` }} /></div>
                </div>
              ))}
              {!data.milestones.length ? <Empty label="Add milestones from the admin dashboard." /> : null}
            </Panel>
            <Panel title="Supporter Tiers">
              {data.tiers.map((tier) => (
                <div key={tier.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{tier.title}</p>
                    <span className="rounded-full px-2 py-1 text-xs text-white" style={{ backgroundColor: tier.badgeColor }}>{tier.badgeIcon}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{tier.oneTimePriceCents ? money(tier.oneTimePriceCents) : ""}{tier.monthlyPriceCents ? `${money(tier.monthlyPriceCents)}/mo` : ""}</p>
                  <p className="mt-2 text-muted-foreground">{tier.perks.slice(0, 2).join(" · ")}</p>
                  <SupporterTierButton tierId={tier.id} />
                </div>
              ))}
              {!data.tiers.length ? <Empty label="Configure supporter tiers in admin." /> : null}
            </Panel>
          </div>
        ) : null}

        {!compact ? <SupporterBadgeShowcase tiers={data.tiers} /> : null}
      </div>
    </section>
  );
}

function Progress({ current, target, percent, small }: { current: number; target: number; percent: number; small?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{money(current)} / {money(target)}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className={`mt-2 overflow-hidden rounded-full bg-muted ${small ? "h-2" : "h-3"}`}>
        <div className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-background/70">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

function Empty({ label, className }: { label: string; className?: string }) {
  return <div className={`rounded-lg border border-dashed p-5 text-sm text-muted-foreground ${className ?? ""}`}>{label}</div>;
}
