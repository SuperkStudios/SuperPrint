import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function requireMerchantApp(request: Request) {
  const configuredToken = process.env.MERCHANT_APP_REVIEW_TOKEN;
  const expectedToken = configuredToken || (process.env.NODE_ENV === "production" ? "" : "superprint-review");
  if (!expectedToken) {
    return NextResponse.json({ error: "Merchant app token is not configured." }, { status: 503 });
  }

  const token = request.headers.get("x-merchant-token")?.trim();
  if (token !== expectedToken) {
    return NextResponse.json({ error: "Merchant app token required." }, { status: 401 });
  }

  return null;
}

export async function requireMerchantUser() {
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return {
      session: null,
      application: null,
      response: NextResponse.json({ error: "Merchant account sign-in required." }, { status: 401 })
    };
  }
  if (!session.user.emailVerified) {
    return {
      session: null,
      application: null,
      response: NextResponse.json({ error: "Verify your email before applying as a merchant." }, { status: 403 })
    };
  }
  const application = await prisma.merchantApplication.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { documents: { orderBy: { uploadedAt: "desc" } } }
  });
  return { session, application, response: null };
}

export async function requireApprovedMerchant() {
  const result = await requireMerchantUser();
  if (result.response) return result;
  if (result.application?.status !== "APPROVED" || result.application.stripeConnectStatus !== "ENABLED") {
    return {
      ...result,
      response: NextResponse.json({ error: "Merchant approval and completed Stripe Connect onboarding required." }, { status: 403 })
    };
  }
  return result;
}
