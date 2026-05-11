import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const maintenanceSchema = z.object({
  taskId: z.string().optional(),
  printerId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  action: z.enum(["create", "start", "complete"])
});

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const tasks = await prisma.maintenanceTask.findMany({
    include: { printer: true },
    orderBy: { dueAt: "asc" }
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = maintenanceSchema.parse(await request.json());
  if (body.action === "create") {
    const task = await prisma.maintenanceTask.create({
      data: {
        printerId: body.printerId!,
        title: body.title!,
        description: body.description ?? "",
        dueAt: new Date(body.dueAt!)
      }
    });
    await recordPlatformEvent({
      type: "MAINTENANCE_DUE",
      actorId: session!.user.id,
      payload: { printerId: task.printerId, title: task.title }
    });
    return NextResponse.json({ task }, { status: 201 });
  }

  const task = await prisma.maintenanceTask.update({
    where: { id: body.taskId },
    data:
      body.action === "complete"
        ? { status: "COMPLETED", completedAt: new Date() }
        : { status: "IN_PROGRESS" }
  });
  return NextResponse.json({ task });
}
