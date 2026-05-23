import { NextResponse } from "next/server";
import { requireMerchantUser } from "@/lib/merchant-app";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "merchant-connect-onboarding", limit: 20, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const { application, response } = await requireMerchantUser();
  if (response) return response;
  if (!application) return NextResponse.json({ error: "Save the merchant application before starting Stripe Connect." }, { status: 400 });

  const stripe = await getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

  try {
    const accountId = application.stripeAccountId ?? (await stripe.accounts.create({
      type: "express",
      country: application.country || "US",
      email: application.ownerEmail,
      business_type: stripeBusinessType(application.businessType),
      business_profile: {
        name: application.businessName,
        url: application.siteUrl
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        superprintMerchantApplicationId: application.id,
        superprintMerchantUserId: application.userId
      }
    })).id;

    const terminalLocationId = application.stripeTerminalLocationId ?? (await stripe.terminal.locations.create({
      display_name: application.businessName,
      address: {
        line1: application.street1,
        line2: application.street2 ?? undefined,
        city: application.city,
        state: application.state,
        postal_code: application.zip,
        country: application.country || "US"
      }
    }, { stripeAccount: accountId })).id;

    const baseUrl = getStripeBaseUrl();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/merchant/connect/refresh?application=${application.id}`,
      return_url: `${baseUrl}/api/merchant/connect/return?application=${application.id}`,
      type: "account_onboarding",
      collect: "eventually_due"
    });

    await prisma.merchantApplication.update({
      where: { id: application.id },
      data: {
        stripeAccountId: accountId,
        stripeTerminalLocationId: terminalLocationId,
        stripeConnectStatus: "ONBOARDING_STARTED"
      }
    });

    return NextResponse.json({ url: accountLink.url, accountId, terminalLocationId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Stripe Connect onboarding." }, { status: 400 });
  }
}

function stripeBusinessType(value: string) {
  if (value === "SOLE_PROPRIETORSHIP") return "individual" as const;
  if (value === "NONPROFIT") return "non_profit" as const;
  return "company" as const;
}
