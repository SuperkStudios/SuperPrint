import { NextResponse } from "next/server";
import { z } from "zod";
import { planMaintenanceTasks } from "@/domain/maintenance-schedule";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const maintenanceSchema = z.object({
  taskId: z.string().optional(),
  printerId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  action: z.enum(["create", "start", "complete", "generateSchedule"])
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
  if (body.action === "generateSchedule") {
    const printers = await prisma.printer.findMany({
      include: {
        maintenanceTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }
      }
    });
    const planned = printers.flatMap((printer) =>
      planMaintenanceTasks({
        printerId: printer.id,
        totalRuntimeMinutes: printer.totalRuntimeMinutes,
        failedPrintCount: printer.failedPrintCount,
        existingOpenTaskTitles: printer.maintenanceTasks.map((task) => task.title)
      })
    );
    const tasks = await Promise.all(planned.map((task) => prisma.maintenanceTask.create({ data: task })));
    for (const task of tasks) {
      await recordPlatformEvent({
        type: "MAINTENANCE_DUE",
        actorId: session!.user.id,
        payload: { printerId: task.printerId, title: task.title }
      });
    }
    return NextResponse.json({ tasks });
  }
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
