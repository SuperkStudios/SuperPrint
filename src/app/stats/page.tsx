import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Award, Boxes, Crown, Flame, Gauge, PackageCheck, Recycle, Sparkles, Star, Trophy, Users } from "lucide-react";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { CyberCard, MetricTile, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const activeOrderStatuses = ["PAID", "QUEUED", "PRINTING"] as const;
const finishedOrderStatuses = ["COMPLETED"] as const;

export default async function StatsPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const [
    orders,
    uploads,
    users,
    jobs,
    completedJobs,
    failedJobs,
    stoppedJobs,
    activeJobs,
    printers,
    filament,
    rewards,
    supporterProfiles,
    factorySupport,
    community
  ] = await Promise.all([
    prisma.order.count(),
    prisma.modelUpload.count(),
    prisma.user.count(),
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "COMPLETED" } }),
    prisma.printJob.count({ where: { status: "FAILED" } }),
    prisma.printJob.count({ where: { status: "STOPPED" } }),
    prisma.printJob.count({ where: { status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"] } } }),
    prisma.printer.findMany({ select: { heartbeatStatus: true, totalRuntimeMinutes: true, completedPrintCount: true, failedPrintCount: true } }),
    prisma.filamentSpool.findMany({ select: { material: true, color: true, startingGrams: true, remainingGrams: true, active: true } }),
    prisma.rewardTransaction.aggregate({ where: { status: "POSTED" }, _sum: { points: true } }),
    prisma.userSupporterProfile.count(),
    prisma.factoryContribution.aggregate({
      where: { paymentStatus: { in: ["manual", "paid", "succeeded"] } },
      _sum: { amountCents: true }
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        createdAt: true,
        rewardsPointsBalance: true,
        _count: { select: { uploads: true, orders: true } },
        supporterProfile: {
          select: {
            lifetimeContributionCents: true,
            founder: true,
            badges: true,
            tier: { select: { title: true, badgeColor: true } }
          }
        },
        orders: {
          select: {
            status: true,
            totalCents: true,
            rewardPointsEarned: true,
            createdAt: true,
            printJobs: {
              select: {
                status: true,
                etaMinutes: true,
                consumedFilamentGrams: true,
                completedAt: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const runtimeHours = Math.round(printers.reduce((total, printer) => total + printer.totalRuntimeMinutes, 0) / 60);
  const onlinePrinters = printers.filter((printer) => printer.heartbeatStatus === "ONLINE").length;
  const activeMaterials = new Set(
    filament
      .filter((spool) => spool.active && spool.remainingGrams > 0)
      .map((spool) => `${spool.material}:${spool.color.toLowerCase()}`)
  ).size;
  const filamentProcessedGrams = filament.reduce((total, spool) => total + Math.max(0, spool.startingGrams - spool.remainingGrams), 0);
  const successEligible = completedJobs + failedJobs;
  const successRate = successEligible > 0 ? Math.round((completedJobs / successEligible) * 100) : 100;
  const completionRate = jobs > 0 ? Math.round((completedJobs / jobs) * 100) : 0;
  const activeCustomers = community.filter((member) => member.orders.length > 0 || member._count.uploads > 0).length;
  const activeOrderCount = await prisma.order.count({ where: { status: { in: [...activeOrderStatuses] } } });
  const finishedOrderCount = await prisma.order.count({ where: { status: { in: [...finishedOrderStatuses] } } });

  const members = community
    .map((member) => {
      const allJobs = member.orders.flatMap((order) => order.printJobs);
      const completed = allJobs.filter((job) => job.status === "COMPLETED").length;
      const active = allJobs.filter((job) => ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"].includes(job.status)).length;
      const grams = allJobs.reduce((total, job) => total + (job.consumedFilamentGrams ?? 0), 0);
      const minutes = allJobs.reduce((total, job) => total + (job.etaMinutes ?? 0), 0);
      const orderTotal = member.orders
        .filter((order) => order.status !== "CANCELED")
        .reduce((total, order) => total + order.totalCents, 0);
      const score = completed * 120
        + member._count.orders * 35
        + member._count.uploads * 30
        + Math.round(grams / 8)
        + Math.round(member.rewardsPointsBalance / 10)
        + Math.round((member.supporterProfile?.lifetimeContributionCents ?? 0) / 100);

      return {
        id: member.id,
        name: publicName(member),
        handle: member.username ? `@${member.username}` : "Claim a handle",
        image: member.image,
        joinedAt: member.createdAt,
        orderCount: member._count.orders,
        uploadCount: member._count.uploads,
        completedPrints: completed,
        activeJobs: active,
        filamentGrams: grams,
        printHours: Math.round(minutes / 60),
        orderTotal,
        rewardsPoints: member.rewardsPointsBalance,
        supporterCents: member.supporterProfile?.lifetimeContributionCents ?? 0,
        supporterTier: member.supporterProfile?.tier?.title,
        badgeColor: member.supporterProfile?.tier?.badgeColor ?? "#00E5FF",
        founder: Boolean(member.supporterProfile?.founder),
        score,
        status: communityStatus({ completed, uploads: member._count.uploads, support: member.supporterProfile?.lifetimeContributionCents ?? 0, active })
      };
    })
    .filter((member) => member.orderCount > 0 || member.uploadCount > 0 || member.supporterCents > 0 || member.rewardsPoints > 0)
    .sort((a, b) => b.score - a.score);

  const topMakers = members.filter((member) => member.completedPrints > 0).sort((a, b) => b.completedPrints - a.completedPrints || b.score - a.score).slice(0, 5);
  const materialMovers = members.filter((member) => member.filamentGrams > 0).sort((a, b) => b.filamentGrams - a.filamentGrams || b.score - a.score).slice(0, 5);
  const queueClimbers = members.filter((member) => member.activeJobs > 0 || member.uploadCount > 0).sort((a, b) => b.activeJobs - a.activeJobs || b.uploadCount - a.uploadCount || b.score - a.score).slice(0, 5);
  const supporters = members.filter((member) => member.supporterCents > 0 || member.supporterTier).sort((a, b) => b.supporterCents - a.supporterCents || b.score - a.score).slice(0, 5);
  const spotlight = members.slice(0, 6);

  return (
    <PageShell>
      <PageSection className="grid gap-8">
        <PageHero
          eyebrow="Community stats"
          title="Build status by building the factory."
          copy="Live platform totals, maker standings, profile stats, and community top spots pulled from real SuperPrint orders, uploads, rewards, supporter activity, and printer telemetry."
        >
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/upload">Get a custom quote</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Claim your profile</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/queue">Watch the queue</Link>
            </Button>
          </div>
        </PageHero>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Community members" value={users} copy={`${activeCustomers} have orders, uploads, rewards, or supporter activity.`} />
          <MetricTile label="Quote and order starts" value={orders} copy={`${activeOrderCount} active now, ${finishedOrderCount} completed.`} />
          <MetricTile label="Models uploaded" value={uploads} copy="Custom files submitted for review, quoting, slicing, or production." />
          <MetricTile label="Platform points posted" value={formatNumber(rewards._sum.points ?? 0)} copy="Rewards points earned through real customer activity." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Completed prints" value={completedJobs} copy={`${completionRate}% of tracked jobs have reached completion.`} />
          <MetricTile label="Print success rate" value={`${successRate}%`} copy={`${failedJobs} failed and ${stoppedJobs} stopped jobs are tracked for transparency.`} />
          <MetricTile label="Filament processed" value={formatKg(filamentProcessedGrams)} copy={`${activeMaterials} active material and color combinations are available.`} />
          <MetricTile label="Factory support" value={formatMoney(factorySupport._sum.amountCents ?? 0)} copy={`${supporterProfiles} supporter profiles are connected to the factory evolution system.`} />
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <CyberCard className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Status board</p>
                <h2 className="mt-3 text-2xl font-semibold">Community top spots</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Status is calculated from completed prints, quote/order activity, uploads, material processed, rewards, and supporter participation.
                </p>
              </div>
              <div className="rounded-xl border bg-background/45 px-4 py-3 text-sm">
                <p className="font-semibold">{runtimeHours}h</p>
                <p className="text-muted-foreground">tracked runtime</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {spotlight.length ? spotlight.map((member, index) => (
                <CommunityRow key={member.id} member={member} rank={index + 1} metric={`${formatNumber(member.score)} pts`} />
              )) : (
                <EmptyBoard title="No community standings yet" copy="The first paid order, custom upload, or supporter action will start the board." />
              )}
            </div>
          </CyberCard>

          <CyberCard>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">How to climb</p>
            <div className="mt-5 grid gap-3">
              <ActionCard icon={PackageCheck} title="Start a quote" copy="Upload a model or checkout a store print to add real activity to your profile." href="/upload" />
              <ActionCard icon={Trophy} title="Finish prints" copy="Completed jobs push maker status the most because they prove real production." href="/store" />
              <ActionCard icon={Sparkles} title="Support upgrades" copy="Factory support adds recognition while keeping normal queue access fair." href="/factory" />
              <ActionCard icon={Users} title="Claim your handle" copy="Set a username and bio so standings look like a community, not anonymous rows." href="/profile" />
            </div>
          </CyberCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Leaderboard title="Top makers" icon={Crown} members={topMakers} metric={(member) => `${member.completedPrints} prints`} empty="Completed prints will rank here." />
          <Leaderboard title="Material movers" icon={Recycle} members={materialMovers} metric={(member) => formatKg(member.filamentGrams)} empty="Tracked filament use will rank here." />
          <Leaderboard title="Queue climbers" icon={Flame} members={queueClimbers} metric={(member) => `${member.activeJobs} active`} empty="Active queue and upload activity will rank here." />
          <Leaderboard title="Factory supporters" icon={Star} members={supporters} metric={(member) => member.supporterTier ?? formatMoney(member.supporterCents)} empty="Supporter profiles will rank here." />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SignalCard icon={Gauge} label="Live printers" value={`${onlinePrinters}/${printers.length}`} copy="Online printer cells reporting through platform telemetry." />
          <SignalCard icon={Activity} label="Active jobs" value={activeJobs} copy="Queued, printing, paused, staged, or waiting for operator start." />
          <SignalCard icon={Boxes} label="Total print jobs" value={jobs} copy="Every tracked store, upload, imported, or operator-admitted print job." />
        </section>
      </PageSection>
    </PageShell>
  );
}

type CommunityMember = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  orderCount: number;
  uploadCount: number;
  completedPrints: number;
  activeJobs: number;
  filamentGrams: number;
  printHours: number;
  rewardsPoints: number;
  supporterCents: number;
  supporterTier?: string;
  badgeColor: string;
  founder: boolean;
  score: number;
  status: string;
};

function CommunityRow({ member, rank, metric }: { member: CommunityMember; rank: number; metric: string }) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-background/45 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex size-10 items-center justify-center rounded-xl border bg-card text-sm font-semibold text-primary">#{rank}</div>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar member={member} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{member.name}</p>
            <span className="rounded-full border px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">{member.status}</span>
          </div>
          <p className="text-sm text-muted-foreground">{member.handle} · {member.completedPrints} completed · {member.uploadCount} uploads</p>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-semibold">{metric}</p>
        <p className="text-xs text-muted-foreground">{formatKg(member.filamentGrams)} processed</p>
      </div>
    </div>
  );
}

function Leaderboard({ title, icon: Icon, members, metric, empty }: { title: string; icon: typeof Trophy; members: CommunityMember[]; metric: (member: CommunityMember) => string; empty: string }) {
  return (
    <CyberCard>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-background/60 text-primary">
          <Icon className="size-5" />
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {members.length ? members.map((member, index) => (
          <LeaderboardRow key={member.id} member={member} rank={index + 1} metric={metric(member)} />
        )) : (
          <EmptyBoard title="Waiting for data" copy={empty} />
        )}
      </div>
    </CyberCard>
  );
}

function LeaderboardRow({ member, rank, metric }: { member: CommunityMember; rank: number; metric: string }) {
  return (
    <div className="rounded-2xl border bg-background/45 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-card text-xs font-semibold text-primary">#{rank}</div>
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.handle}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{member.status}</span>
        <span className="font-semibold">{metric}</span>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, copy, href }: { icon: typeof Trophy; title: string; copy: string; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border bg-background/45 p-4 transition hover:border-primary/60 hover:bg-primary/5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 font-semibold group-hover:text-primary">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </Link>
  );
}

function SignalCard({ icon: Icon, label, value, copy }: { icon: typeof Trophy; label: string; value: string | number; copy: string }) {
  return (
    <CyberCard>
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 font-medium">{label}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
    </CyberCard>
  );
}

function EmptyBoard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-background/35 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

function Avatar({ member }: { member: CommunityMember }) {
  return member.image ? (
    <img src={member.image} alt="" className="size-11 rounded-xl border object-cover" />
  ) : (
    <span className="flex size-11 items-center justify-center rounded-xl border bg-card text-sm font-semibold" style={{ color: member.badgeColor }}>
      {member.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function publicName(member: { name: string; username?: string | null }) {
  return member.username || member.name || "SuperPrint maker";
}

function communityStatus(input: { completed: number; uploads: number; support: number; active: number }) {
  if (input.support >= 25000) return "Founding operator";
  if (input.completed >= 25) return "Print legend";
  if (input.completed >= 10) return "Factory regular";
  if (input.completed >= 3) return "Maker";
  if (input.active > 0) return "In queue";
  if (input.uploads > 0) return "Quoting";
  if (input.support > 0) return "Supporter";
  return "New maker";
}

function formatKg(grams: number) {
  if (grams >= 1000) return `${Number((grams / 1000).toFixed(1))}kg`;
  return `${formatNumber(grams)}g`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
