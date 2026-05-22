import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { getStripeBaseUrl, getStripeSettings } from "@/lib/stripe";

export async function GET() {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const settings = await getStripeSettings();
  return NextResponse.json({
    mode: settings.mode,
    configured: settings.configured,
    publishableKey: settings.publishableKey,
    terminalLocationId: settings.terminalLocationId,
    backendUrl: getStripeBaseUrl()
  });
}
