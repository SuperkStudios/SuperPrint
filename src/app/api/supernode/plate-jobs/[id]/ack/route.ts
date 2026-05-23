import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgeProductionPlateSliced } from "@/services/production-plates";

const schema = z.object({
  nodeId: z.string().min(1),
  localJobPath: z.string().min(1),
  gcodeBase64: z.string().optional().nullable(),
  estimatedPrintMinutes: z.number().int().positive().optional().nullable(),
  estimatedGrams: z.number().int().positive().optional().nullable(),
  slicerMessage: z.string().optional().nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const body = schema.parse(await request.json());
  try {
    return NextResponse.json({
      job: await acknowledgeProductionPlateSliced({
        plateJobId: id,
        nodeId: body.nodeId,
        bearer,
        localJobPath: body.localJobPath,
        gcodeBase64: body.gcodeBase64,
        estimatedPrintMinutes: body.estimatedPrintMinutes,
        estimatedGrams: body.estimatedGrams,
        slicerMessage: body.slicerMessage
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Plate acknowledgement blocked" }, { status: 400 });
  }
}
