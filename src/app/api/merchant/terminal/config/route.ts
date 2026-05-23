import { NextResponse } from "next/server";
import { getStripeSettings } from "@/lib/stripe";
import { requireMerchantUser } from "@/lib/merchant-app";

export async function GET() {
  const { application, response } = await requireMerchantUser();
  if (response) return response;

  const settings = await getStripeSettings();
  return NextResponse.json({
    publishableKey: settings.publishableKey,
    terminalLocationId: application?.stripeTerminalLocationId ?? settings.terminalLocationId,
    configured: settings.configured,
    mode: settings.mode,
    merchantStatus: application?.status ?? "DRAFT",
    connectStatus: application?.stripeConnectStatus ?? "NOT_STARTED"
  });
}
