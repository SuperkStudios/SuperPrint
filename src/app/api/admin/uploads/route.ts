import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";
import { buildModelReviewPayload } from "@/domain/uploads";

const actionSchema = z.object({
  uploadId: z.string(),
  action: z.enum(["approve", "reject"]),
  estimatedPriceCents: z.number().int().positive().optional(),
  estimatedPrintMinutes: z.number().int().positive().optional(),
  rejectionReason: z.string().optional()
});

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const uploads = await prisma.modelUpload.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ uploads });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = actionSchema.parse(await request.json());
  const approved = body.action === "approve";
  const upload = await prisma.modelUpload.update({
    where: { id: body.uploadId },
    data: approved
      ? {
          status: "APPROVED",
          approvedById: session!.user.id,
          approvedAt: new Date(),
          estimatedPriceCents: body.estimatedPriceCents,
          estimatedPrintMinutes: body.estimatedPrintMinutes
        }
      : {
          status: "REJECTED",
          rejectionReason: body.rejectionReason ?? "Model needs revision before printing."
        }
  });

  await recordPlatformEvent({
    type: approved ? "MODEL_APPROVED" : "MODEL_REJECTED",
    actorId: session!.user.id,
    payload: buildModelReviewPayload({
      uploadId: upload.id,
      fileName: upload.fileName,
      status: approved ? "APPROVED" : "REJECTED",
      rejectionReason: upload.rejectionReason
    })
  });

  return NextResponse.json({ upload });
}
