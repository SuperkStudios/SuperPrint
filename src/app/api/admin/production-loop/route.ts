import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { getProductionLoopState, runProductionLoopAction } from "@/services/production-loop";

const actionSchema = z.object({
  action: z.enum([
    "startProduction",
    "confirmFilamentChanged",
    "runAiPlateCheck",
    "confirmPlateClear",
    "sendPlateToPrinter",
    "markPrintFinished",
    "markPartsInventoried",
    "markOrderPacked"
  ]),
  plateJobId: z.string().optional(),
  orderId: z.string().optional()
});

export async function GET() {
  const { response } = await requireAdmin("products");
  if (response) return response;
  return NextResponse.json(await getProductionLoopState());
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("products");
  if (response) return response;

  try {
    const body = actionSchema.parse(await request.json());
    const result = await runProductionLoopAction({
      action: body.action,
      plateJobId: body.plateJobId,
      orderId: body.orderId,
      actorId: session?.user.id
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Production action failed." }, { status: 400 });
  }
}
