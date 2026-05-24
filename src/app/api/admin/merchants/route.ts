import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const applications = await prisma.merchantApplication.findMany({
    include: {
      user: { select: { email: true, name: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({
    applications: applications.map((application) => ({
      id: application.id,
      user: application.user,
      status: application.status,
      businessName: application.businessName,
      legalBusinessName: application.legalBusinessName,
      businessType: application.businessType,
      siteUrl: application.siteUrl,
      ownerName: application.ownerName,
      ownerEmail: application.ownerEmail,
      phone: application.phone,
      street1: application.street1,
      street2: application.street2,
      city: application.city,
      state: application.state,
      zip: application.zip,
      country: application.country,
      taxIdType: application.taxIdType,
      taxIdLast4: application.taxIdLast4,
      stripeConnectStatus: application.stripeConnectStatus,
      stripeAccountId: application.stripeAccountId,
      stripeTerminalLocationId: application.stripeTerminalLocationId,
      stripeChargesEnabled: application.stripeChargesEnabled,
      stripePayoutsEnabled: application.stripePayoutsEnabled,
      stripeDetailsSubmitted: application.stripeDetailsSubmitted,
      stripeRequirementsDue: Array.isArray(application.stripeRequirementsDue)
        ? application.stripeRequirementsDue.filter((item): item is string => typeof item === "string")
        : [],
      reviewNotes: application.reviewNotes,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      approvedAt: application.approvedAt?.toISOString() ?? null,
      rejectedAt: application.rejectedAt?.toISOString() ?? null,
      updatedAt: application.updatedAt.toISOString()
    }))
  });
}
