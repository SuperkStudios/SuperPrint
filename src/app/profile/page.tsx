import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { ProfileForm } from "@/components/profile-form";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getRewardsSettings } from "@/services/rewards";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to edit profile" copy="Your profile connects orders, uploads, and production updates." />;
  }
  const [user, rewardTransactions, rewardsSettings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.rewardTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    getRewardsSettings()
  ]);

  return (
    <PageShell>
      <PageSection className="max-w-3xl">
      <PageHero eyebrow="Customer profile" title="Profile" copy="Set your profile photo, username, and bio for your SuperPrint account." />
      <div className="mt-8 grid gap-4">
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
