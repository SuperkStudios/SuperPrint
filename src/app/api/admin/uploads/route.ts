import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { approveUploadForSlicing, rejectUploadForCustomer } from "@/services/model-review";
import { filamentMaterials } from "@/domain/printer-profile";

const actionSchema = z.object({
  uploadId: z.string(),
  action: z.enum(["approve", "reject"]),
  estimatedPriceCents: z.number().int().positive().optional(),
  estimatedGrams: z.number().int().positive().optional(),
  estimatedPrintMinutes: z.number().int().positive().optional(),
  selectedMaterial: z.enum(filamentMaterials).optional(),
  selectedPrinterId: z.string().optional(),
  adminNotes: z.string().optional(),
  rejectionReason: z.string().optional()
});

export async function GET() {
  const { response } = await requireAdmin("uploads");
  if (response) return response;

  const uploads = await prisma.modelUpload.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ uploads });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("uploads");
  if (response) return response;

  const body = actionSchema.parse(await request.json());
  if (body.action === "approve") {
    const upload = await prisma.modelUpload.findUnique({ where: { id: body.uploadId } });
    const estimatedGrams = body.estimatedGrams ?? upload?.estimatedGrams ?? undefined;
    const estimatedPrintMinutes = body.estimatedPrintMinutes ?? upload?.estimatedPrintMinutes ?? undefined;
    if (!estimatedGrams || !estimatedPrintMinutes || !body.selectedMaterial || !body.selectedPrinterId) {
      return NextResponse.json({ error: "Approval requires grams, print time, material, and printer profile" }, { status: 400 });
    }
    return NextResponse.json(
      await approveUploadForSlicing(
        body.uploadId,
        {
          adminNotes: body.adminNotes,
          estimatedPriceCents: body.estimatedPriceCents,
          estimatedGrams,
          estimatedPrintMinutes,
          selectedMaterial: body.selectedMaterial,
          selectedPrinterId: body.selectedPrinterId
        },
        session!.user.id
      )
    );
  }

  return NextResponse.json({
    upload: await rejectUploadForCustomer(body.uploadId, body.rejectionReason ?? "Model needs revision.", session!.user.id)
  });
}
