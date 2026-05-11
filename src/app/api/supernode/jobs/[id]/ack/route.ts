import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgeNodeReady } from "@/services/supernode-jobs";

const schema = z.object({
  nodeId: z.string().min(1),
  localJobPath: z.string().min(1)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const body = schema.parse(await request.json());
  try {
    return NextResponse.json({ job: await acknowledgeNodeReady(id, body.nodeId, bearer, body.localJobPath) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Node acknowledgement blocked" }, { status: 400 });
  }
}
