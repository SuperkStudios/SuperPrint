import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export { POST } from "../../uploads/route";

export async function GET() {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const uploads = await prisma.modelUpload.findMany({
    where: { customerId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 40
  });
  return NextResponse.json({
    uploads: uploads.map((upload) => ({
      id: upload.id,
      fileName: upload.fileName,
      status: upload.status,
      notes: upload.notes,
      estimatedGrams: upload.estimatedGrams,
      estimatedPrintMinutes: upload.estimatedPrintMinutes,
      estimatedPriceCents: upload.estimatedPriceCents,
      createdAt: upload.createdAt.toISOString()
    }))
  });
}
