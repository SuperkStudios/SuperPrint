import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import {
  completePrintJob,
  failPrintJob,
  getAdminQueueState,
  pausePrintJob,
  approvePhysicalPrintStart,
  requeuePrintJob,
  reorderPrintQueue,
  stopPrintJob
} from "@/services/queue";

const actionSchema = z.object({
  action: z.enum(["reorder", "approvePhysicalStart", "pause", "complete", "stop", "fail", "requeue"]),
  printJobId: z.string().optional(),
  orderedIds: z.array(z.string()).optional(),
  checklist: z
    .object({
      correctFilamentLoaded: z.boolean(),
      buildPlateClear: z.boolean(),
      cameraVisible: z.boolean(),
      printerAreaSafe: z.boolean(),
      gcodeVerifiedOnNode: z.boolean()
    })
    .optional(),
  reason: z.string().optional(),
  requeueAfterFailure: z.boolean().optional()
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
  if (body.action === "approvePhysicalStart") {
    if (!body.checklist) {
      return NextResponse.json({ error: "Operator checklist is required" }, { status: 400 });
    }
    try {
      return NextResponse.json({ job: await approvePhysicalPrintStart(body.printJobId, body.checklist as never, session!.user.id) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Physical start approval blocked" }, { status: 400 });
    }
  }
  if (body.action === "complete") {
    return NextResponse.json({ job: await completePrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "pause") {
    return NextResponse.json({ job: await pausePrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "stop") {
    return NextResponse.json({ job: await stopPrintJob(body.printJobId, session!.user.id) });
  }
  if (body.action === "requeue") {
    return NextResponse.json({ job: await requeuePrintJob(body.printJobId, session!.user.id) });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "Failure reason is required" }, { status: 400 });
  }
  const failedJob = await failPrintJob(body.printJobId, body.reason, session!.user.id);
  if (body.requeueAfterFailure) {
    return NextResponse.json({
      failedJob,
      job: await requeuePrintJob(body.printJobId, session!.user.id)
    });
  }
  return NextResponse.json({ job: failedJob });
}
