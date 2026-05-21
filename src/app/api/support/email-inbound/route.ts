import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestSupportEmail } from "@/services/support";

const inboundSchema = z.object({
  from: z.string().email(),
  to: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().trim().min(1).max(20000)
});

export async function POST(request: Request) {
  const configuredSecret = process.env.SUPERMAIL_INBOUND_SECRET;
  if (configuredSecret) {
    const provided = request.headers.get("x-supermail-signature") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const body = inboundSchema.parse(await request.json());
    const ticket = await ingestSupportEmail(body);
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not ingest support email." }, { status: 400 });
  }
}
