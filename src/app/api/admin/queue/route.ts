import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import {
  completePrintJob,
  failPrintJob,
  getAdminQueueState,
  pausePrintJob,
  requeuePrintJob,
  reorderPrintQueue,
  startPrintJob
} from "@/services/queue";

const actionSchema = z.object({
  action: z.enum(["reorder", "start", "pause", "complete", "fail", "requeue"]),
  printJobId: z.string().optional(),
  orderedIds: z.array(z.string()).optional(),
  reason: z.string().optional()
});

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  return NextResponse.json({ jobs: await getAdminQueueState() });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = actionSchema.parse(await request.json());
  if (body.action === "reorder") {
    return NextResponse.json({ jobs: await reorderPrintQueue(body.orderedIds ?? []) });
  }
  if (!body.printJobId) {
    return NextResponse.json({ error: "printJobId is required" }, { status: 400 });
  }
  if (body.action === "start") {
    return NextResponse.json({ job: await startPrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "complete") {
    return NextResponse.json({ job: await completePrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "pause") {
    return NextResponse.json({ job: await pausePrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "requeue") {
    return NextResponse.json({ job: await requeuePrintJob(body.printJobId, session!.user.id) });
  }
  return NextResponse.json({ job: await failPrintJob(body.printJobId, body.reason ?? "Print failed", session!.user.id) });
}
