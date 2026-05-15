import { NextResponse } from "next/server";
import { validatePrinterProfile } from "@/domain/printer-profile";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

export async function GET() {
  const { response } = await requireAdmin("printers");
  if (response) return response;

  const printers = await prisma.printer.findMany({
    include: { currentFilament: true },
    orderBy: { publicName: "asc" }
  });
  return NextResponse.json({ printers });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("printers");
  if (response) return response;

  const body = await request.json();
  const id = typeof body.id === "string" && body.id.length > 0 ? body.id : undefined;
  const profile = validatePrinterProfile(body);
  const data = {
    name: profile.name,
    publicName: profile.publicName,
    modelName: profile.modelName,
    nozzleSizeMm: profile.nozzleSizeMm,
    buildVolumeXmm: profile.buildVolumeXmm,
    buildVolumeYmm: profile.buildVolumeYmm,
    buildVolumeZmm: profile.buildVolumeZmm,
    supportedMaterials: profile.supportedMaterials,
    currentFilamentId: profile.currentFilamentId,
    cameraSource: profile.cameraSource,
    maintenanceProfile: profile.maintenanceProfile,
    internalIp: profile.internalIp,
    controlApiUrl: profile.controlApiUrl,
    healthDescription: profile.healthDescription,
    status: profile.status,
    heartbeatStatus: profile.heartbeatStatus,
    totalRuntimeMinutes: profile.totalRuntimeMinutes,
    completedPrintCount: profile.completedPrintCount,
    failedPrintCount: profile.failedPrintCount
  };

  const printer = id
    ? await prisma.printer.update({ where: { id }, data })
    : await prisma.printer.create({ data });

  await recordPlatformEvent({
    type: "MAINTENANCE_DUE",
    actorId: session!.user.id,
    payload: {
      action: id ? "PRINTER_PROFILE_UPDATED" : "PRINTER_PROFILE_CREATED",
      printerId: printer.id,
      printerName: printer.publicName,
      modelName: printer.modelName
    }
  });

  return NextResponse.json({ printer });
}
