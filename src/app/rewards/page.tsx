import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { RewardsRedemptionPanel } from "@/components/rewards-redemption-panel";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getCurrentSession } from "@/lib/auth";
import { getRewardsSummary } from "@/services/rewards";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view rewards" copy="Rewards are attached to your SuperPrint account and can be applied at checkout." />;
  }

  const summary = await getRewardsSummary(session.user.id);
  const serializedSummary = JSON.parse(JSON.stringify(summary));

  return (
    <PageShell>
      <PageSection className="max-w-5xl">
        <PageHero
          eyebrow="Customer rewards"
          title="Rewards"
          copy="Turn points into checkout rewards, apply them to eligible product orders, or unredeem unused rewards back into points."
        />
        <RewardsRedemptionPanel initialSummary={serializedSummary} />
      </PageSection>
    </PageShell>
  );
}
