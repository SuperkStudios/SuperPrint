"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

type RewardTransaction = {
  id: string;
  type: string;
  status: string;
  points: number;
  centsBasis: number;
  description: string;
  orderId?: string | null;
  createdAt: string | Date;
};

type RewardsSummary = {
  balance: number;
  redeemableCents: number;
  rewardPresets: Array<{
    id: string;
    label: string;
    description: string;
    points: number;
    kind: "AMOUNT_OFF" | "PERCENT_OFF" | "FREE_SHIPPING";
    valueCents?: number;
    percent?: number;
  }>;
  settings: {
    pointsPerDollar: number;
    redemptionPointsPerDollar: number;
    minimumRedemptionPoints: number;
  };
  activeRedemptions: RewardTransaction[];
  transactions: RewardTransaction[];
};

export function RewardsRedemptionPanel({ initialSummary }: { initialSummary: RewardsSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [selectedRewardId, setSelectedRewardId] = useState(initialSummary.rewardPresets[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const activePoints = summary.activeRedemptions.reduce((total, reward) => total + Math.abs(reward.points), 0);
  const activatablePoints = summary.balance + activePoints;
  const selectedReward = useMemo(() => summary.rewardPresets.find((reward) => reward.id === selectedRewardId) ?? summary.rewardPresets[0], [selectedRewardId, summary.rewardPresets]);

  async function run(action: "redeem" | "unredeem", rewardTransactionId?: string) {
    if (action === "redeem" && !selectedReward) return;
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/rewards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "redeem" ? { action, rewardId: selectedReward.id, points: selectedReward.points } : { action, rewardTransactionId })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Rewards update failed.");
      return;
    }
    setSummary(body.summary);
    setMessage(action === "redeem" ? "Active reward updated for checkout." : "Reward returned to your points.");
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="grid content-start gap-4 rounded border bg-card p-5 text-card-foreground shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Available balance</p>
          <p className="mt-2 text-4xl font-semibold">{summary.balance} points</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Earn {summary.settings.pointsPerDollar} points per $1. Rewards do not earn points on the order where they are used.
          </p>
        </div>

        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm font-medium">Activate checkout reward</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.rewardPresets.map((reward) => {
              const disabled = reward.points > activatablePoints;
              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedRewardId(reward.id)}
                  className={`rounded-md border p-3 text-left transition ${selectedReward?.id === reward.id ? "border-primary bg-primary/10" : "bg-background hover:bg-muted"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <span className="block font-medium">{reward.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{reward.points} points</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{reward.description}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            Product subtotal must stay at least {money(500)} after product discounts. Max points spend is 1000 for {money(1000)} off.
          </p>
          <Button
            type="button"
            onClick={() => run("redeem")}
            disabled={loading || !selectedReward || selectedReward.points > activatablePoints}
          >
            Activate reward
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>

      <section className="grid content-start gap-4 rounded border bg-card p-5 text-card-foreground shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">Checkout rewards</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only one reward can be active at a time. It auto-applies to your next eligible checkout.</p>
        </div>
        <div className="grid gap-3">
          {summary.activeRedemptions.length ? summary.activeRedemptions.slice(0, 1).map((reward) => (
            <div key={reward.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
              <div>
                <p className="font-medium">{reward.description.replace(/\s*\[reward:[^\]]+\]/, "")}</p>
                <p className="text-sm text-muted-foreground">{Math.abs(reward.points)} points redeemed</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => run("unredeem", reward.id)}>
                Unredeem
              </Button>
            </div>
          )) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No checkout rewards ready yet.</p>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold">Recent rewards</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {summary.transactions.length ? summary.transactions.slice(0, 8).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
                <span className="text-muted-foreground">{transaction.description}</span>
                <span className={transaction.points >= 0 ? "font-medium text-primary" : "font-medium"}>
                  {transaction.points >= 0 ? "+" : ""}{transaction.points} pts
                </span>
              </div>
            )) : (
              <p className="text-muted-foreground">Rewards activity will appear here after your first paid product order.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
