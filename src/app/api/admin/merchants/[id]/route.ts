import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  action: z.enum(["approve", "reject", "needs_review"]),
  reviewNotes: z.string().trim().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const { id } = await params;
  const body = schema.parse(await request.json());
  const now = new Date();
  const application = await prisma.merchantApplication.update({
    where: { id },
    data: {
      status: body.action === "approve" ? "APPROVED" : body.action === "reject" ? "REJECTED" : "NEEDS_REVIEW",
      reviewNotes: body.reviewNotes || null,
      approvedAt: body.action === "approve" ? now : null,
      rejectedAt: body.action === "reject" ? now : null
    }
  });
  return NextResponse.json({
    application: {
      ...application,
      stripeRequirementsDue: Array.isArray(application.stripeRequirementsDue)
        ? application.stripeRequirementsDue.filter((item): item is string => typeof item === "string")
        : [],
      submittedAt: application.submittedAt?.toISOString() ?? null,
      approvedAt: application.approvedAt?.toISOString() ?? null,
      rejectedAt: application.rejectedAt?.toISOString() ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString()
    }
  });
}
