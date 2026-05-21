import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthRequired } from "@/components/auth-required";
import { ProfileForm } from "@/components/profile-form";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CyberCard, MetricTile, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getRewardsSettings } from "@/services/rewards";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to edit profile" copy="Your profile connects orders, uploads, and production updates." />;
  }
  const [user, rewardTransactions, rewardsSettings, community] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      include: {
        supporterProfile: { include: { tier: true } },
        uploads: { select: { id: true, status: true } },
        orders: {
          select: {
            id: true,
            status: true,
            totalCents: true,
            rewardPointsEarned: true,
            printJobs: {
              select: {
                status: true,
                etaMinutes: true,
                consumedFilamentGrams: true
              }
            }
          }
        }
      }
    }),
    prisma.rewardTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    getRewardsSettings(),
    prisma.user.findMany({
      select: {
        id: true,
        rewardsPointsBalance: true,
        _count: { select: { orders: true, uploads: true } },
        supporterProfile: { select: { lifetimeContributionCents: true } },
        orders: {
          select: {
            printJobs: { select: { status: true, consumedFilamentGrams: true } }
          }
        }
      }
    })
  ]);
  const allJobs = user.orders.flatMap((order) => order.printJobs);
  const completedPrints = allJobs.filter((job) => job.status === "COMPLETED").length;
  const activePrints = allJobs.filter((job) => ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"].includes(job.status)).length;
  const filamentGrams = allJobs.reduce((total, job) => total + (job.consumedFilamentGrams ?? 0), 0);
  const printHours = Math.round(allJobs.reduce((total, job) => total + (job.etaMinutes ?? 0), 0) / 60);
  const supporterCents = user.supporterProfile?.lifetimeContributionCents ?? 0;
  const score = communityScore({
    completedPrints,
    orders: user.orders.length,
    uploads: user.uploads.length,
    filamentGrams,
    rewardsPoints: user.rewardsPointsBalance,
    supporterCents
  });
  const rankedScores = community.map((member) => {
    const memberJobs = member.orders.flatMap((order) => order.printJobs);
    return {
      id: member.id,
      score: communityScore({
        completedPrints: memberJobs.filter((job) => job.status === "COMPLETED").length,
        orders: member._count.orders,
        uploads: member._count.uploads,
        filamentGrams: memberJobs.reduce((total, job) => total + (job.consumedFilamentGrams ?? 0), 0),
        rewardsPoints: member.rewardsPointsBalance,
        supporterCents: member.supporterProfile?.lifetimeContributionCents ?? 0
      })
    };
  }).sort((a, b) => b.score - a.score);
  const rank = rankedScores.findIndex((member) => member.id === user.id) + 1;
  const status = profileStatus({ completedPrints, uploads: user.uploads.length, support: supporterCents, active: activePrints });

  return (
    <PageShell>
      <PageSection className="max-w-5xl">
      <PageHero eyebrow="Customer profile" title="Profile" copy="Set your profile photo, username, bio, shipping details, and build your SuperPrint community status.">
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/upload">Start a quote</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/stats">View community stats</Link>
          </Button>
        </div>
      </PageHero>
      <div className="mt-8 grid gap-4">
        <CyberCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Maker status</p>
              <h2 className="mt-3 text-3xl font-semibold">{status}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your status grows from real platform activity: quotes, uploads, completed prints, filament processed, rewards, and factory support.
              </p>
            </div>
            <div className="rounded-xl border bg-background/50 px-4 py-3 text-right">
              <p className="text-2xl font-semibold">#{rank || "-"}</p>
              <p className="text-sm text-muted-foreground">community rank</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Status score" value={score} />
            <MetricTile label="Completed prints" value={completedPrints} />
            <MetricTile label="Filament processed" value={formatProfileKg(filamentGrams)} />
            <MetricTile label="Print hours" value={`${printHours}h`} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ProfileNudge title="Get quoted" copy="Upload a custom model so it can be reviewed, estimated, and added to your profile activity." href="/upload" />
            <ProfileNudge title="Finish prints" copy="Completed jobs move your maker status faster than anything else." href="/store" />
            <ProfileNudge title="Join the board" copy="Add a username and profile image so your top spots look clean on community stats." href="/profile" />
          </div>
        </CyberCard>
        <section className="rounded border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Rewards</h3>
              <p className="mt-1 text-sm text-muted-foreground">Earn {rewardsSettings.pointsPerDollar} points per $1. Redeem {rewardsSettings.redemptionPointsPerDollar} points for $1 off.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{user.rewardsPointsBalance}</p>
              <p className="text-sm text-muted-foreground">points available</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {rewardTransactions.length ? rewardTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 border-t pt-2">
                <span className="text-muted-foreground">{transaction.description}</span>
                <span className={transaction.points >= 0 ? "font-medium text-primary" : "font-medium"}>{transaction.points >= 0 ? "+" : ""}{transaction.points} pts</span>
              </div>
            )) : (
              <p className="text-muted-foreground">Rewards activity will appear after your first paid product order.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Current redemption value: {rewardsSettings.redemptionPointsPerDollar} points = $1 off eligible product purchases.</p>
        </section>
        <ProfileForm user={user} />
      </div>
      </PageSection>
    </PageShell>
  );
}

function ProfileNudge({ title, copy, href }: { title: string; copy: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-background/45 p-4 transition hover:border-primary/60 hover:bg-primary/5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </Link>
  );
}

function communityScore(input: { completedPrints: number; orders: number; uploads: number; filamentGrams: number; rewardsPoints: number; supporterCents: number }) {
  return input.completedPrints * 120
    + input.orders * 35
    + input.uploads * 30
    + Math.round(input.filamentGrams / 8)
    + Math.round(input.rewardsPoints / 10)
    + Math.round(input.supporterCents / 100);
}

function profileStatus(input: { completedPrints: number; uploads: number; support: number; active: number }) {
  if (input.support >= 25000) return "Founding Operator";
  if (input.completedPrints >= 25) return "Print Legend";
  if (input.completedPrints >= 10) return "Factory Regular";
  if (input.completedPrints >= 3) return "Maker";
  if (input.active > 0) return "In Queue";
  if (input.uploads > 0) return "Quoting";
  if (input.support > 0) return "Supporter";
  return "New Maker";
}

function formatProfileKg(grams: number) {
  if (grams >= 1000) return `${Number((grams / 1000).toFixed(1))}kg`;
  return `${new Intl.NumberFormat("en-US").format(grams)}g`;
}
