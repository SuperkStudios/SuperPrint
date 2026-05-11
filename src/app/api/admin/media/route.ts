import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { attachDemoOrderMedia } from "@/services/media";

const schema = z.object({
  orderId: z.string()
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = schema.parse(await request.json());
  return NextResponse.json({ media: await attachDemoOrderMedia(body.orderId, session!.user.id) }, { status: 201 });
}
