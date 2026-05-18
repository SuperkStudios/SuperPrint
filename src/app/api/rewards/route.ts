import { NextResponse } from "next/server";
import { z } from "zod";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { requireCustomer } from "@/lib/http";
import { createRewardRedemption, getRewardsSummary, releaseRewardRedemption } from "@/services/rewards";

const rewardActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("redeem"),
    points: z.number().int().positive()
  }),
  z.object({
    action: z.literal("unredeem"),
    rewardTransactionId: z.string()
  })
]);

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const summary = await getRewardsSummary(session!.user.id);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const body = rewardActionSchema.parse(await request.json());
  try {
    if (body.action === "redeem") {
      const reward = await createRewardRedemption({ userId: session!.user.id, requestedPoints: body.points });
      return NextResponse.json({ reward, summary: await getRewardsSummary(session!.user.id) }, { status: 201 });
    }
    const reward = await releaseRewardRedemption({ userId: session!.user.id, rewardTransactionId: body.rewardTransactionId });
    return NextResponse.json({ reward, summary: await getRewardsSummary(session!.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rewards update failed." }, { status: 400 });
  }
}
