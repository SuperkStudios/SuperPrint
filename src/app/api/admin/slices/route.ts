import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { admitSliceJobToQueue } from "@/services/queue-admission";

const actionSchema = z.object({
  sliceJobId: z.string(),
  action: z.enum(["admit"])
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = actionSchema.parse(await request.json());
  try {
    return NextResponse.json(await admitSliceJobToQueue(body.sliceJobId, session!.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Queue admission blocked" }, { status: 400 });
  }
}
