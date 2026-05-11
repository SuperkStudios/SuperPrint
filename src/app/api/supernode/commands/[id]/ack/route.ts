import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgePrintCommand } from "@/services/supernode-jobs";

const schema = z.object({ nodeId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const body = schema.parse(await request.json());
  try {
    return NextResponse.json({ job: await acknowledgePrintCommand(id, body.nodeId, bearer) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Command acknowledgement blocked" }, { status: 400 });
  }
}
