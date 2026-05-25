import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { getStripeBaseUrl, getStripeSettings } from "@/lib/stripe";
import { getPricingSettings } from "@/services/pricing";

export async function GET() {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const [settings, pricingSettings] = await Promise.all([getStripeSettings(), getPricingSettings()]);
  return NextResponse.json({
    mode: settings.mode,
    configured: settings.configured,
    publishableKey: settings.publishableKey,
    terminalLocationId: settings.terminalLocationId,
    backendUrl: getStripeBaseUrl(),
    pricing: {
      taxPercentEstimate: pricingSettings.taxPercentEstimate,
      paymentProcessingPercent: pricingSettings.paymentProcessingPercent,
      paymentProcessingFixedCents: pricingSettings.paymentProcessingFixedCents
    }
  });
}
