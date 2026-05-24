import { NextResponse } from "next/server";
import { requireMerchantUser } from "@/lib/merchant-app";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createMerchantConnectOnboardingLink, requestBaseUrl } from "@/services/merchant-connect-onboarding";

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "merchant-connect-onboarding", limit: 20, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const { application, response } = await requireMerchantUser();
  if (response) return response;
  if (!application) return NextResponse.json({ error: "Save the merchant application before starting Stripe Connect." }, { status: 400 });

  try {
    return NextResponse.json(await createMerchantConnectOnboardingLink(application, requestBaseUrl(request)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Stripe Connect onboarding." }, { status: 400 });
  }
}
