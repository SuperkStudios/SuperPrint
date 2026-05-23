import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { getProductionPlateDashboard, rebuildProductionPlateJobs, updateProductionPlateJobStatus } from "@/services/production-plates";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rebuild") }),
  z.object({
    action: z.literal("status"),
    id: z.string().min(1),
    status: z.enum(["PLANNED", "SLICING", "READY", "NEEDS_FILAMENT", "PRINTING", "PRINTED", "INVENTORIED", "CANCELED", "FAILED"]),
    printedQuantity: z.number().int().nonnegative().optional(),
    inventoriedQuantity: z.number().int().nonnegative().optional(),
    lastError: z.string().optional().nullable()
  })
]);

export async function GET() {
  const { response } = await requireAdmin("products");
  if (response) return response;
  return NextResponse.json(await getProductionPlateDashboard());
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("products");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    if (body.action === "rebuild") {
      return NextResponse.json({ jobs: await rebuildProductionPlateJobs(session?.user.id) });
    }
    return NextResponse.json({ job: await updateProductionPlateJobStatus(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Production plate update failed" }, { status: 400 });
  }
}
