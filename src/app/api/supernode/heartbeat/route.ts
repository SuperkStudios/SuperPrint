import { NextResponse } from "next/server";
import { z } from "zod";
import { compareNodeSecret, verifyNodeHeartbeat } from "@/domain/supernode-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  nodeId: z.string().min(1),
  printerId: z.string().optional().nullable(),
  timestamp: z.string().datetime(),
  heartbeatStatus: z.enum(["ONLINE", "STALE", "OFFLINE"]).default("ONLINE"),
  printerStatus: z.enum(["HEALTHY", "WARNING", "OFFLINE", "MAINTENANCE"]),
  cameraStatus: z.enum(["UNKNOWN", "ONLINE", "OFFLINE"]).default("UNKNOWN"),
  localPaths: z
    .object({
      uploads: z.string().optional(),
      sliced: z.string().optional(),
      videos: z.string().optional(),
      timelapses: z.string().optional(),
      thumbnails: z.string().optional()
    })
    .default({}),
  retryCount: z.number().int().min(0).default(0),
  lastError: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const signature = request.headers.get("x-supernode-signature") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const rawBody = await request.text();
  const body = schema.parse(JSON.parse(rawBody));

  const node = await prisma.superNode.findUnique({ where: { nodeId: body.nodeId } });
  if (!node || !bearer || !(await compareNodeSecret(bearer, node.secretHash))) {
    return NextResponse.json({ error: "Invalid SuperNode credentials" }, { status: 401 });
  }
  if (!verifyNodeHeartbeat(rawBody, signature, bearer)) {
    return NextResponse.json({ error: "Invalid SuperNode heartbeat signature" }, { status: 401 });
  }

  const heartbeatAt = new Date(body.timestamp);
  const updatedNode = await prisma.superNode.update({
    where: { nodeId: body.nodeId },
    data: {
      printerId: body.printerId ?? node.printerId,
      heartbeatStatus: body.heartbeatStatus,
      printerStatus: body.printerStatus,
      cameraStatus: body.cameraStatus,
      localUploadPath: body.localPaths.uploads,
      localSlicedPath: body.localPaths.sliced,
      localVideoPath: body.localPaths.videos,
      localTimelapsePath: body.localPaths.timelapses,
      localThumbnailPath: body.localPaths.thumbnails,
      lastHeartbeatAt: heartbeatAt,
      retryCount: body.retryCount,
      lastError: body.lastError ?? null
    }
  });

  if (updatedNode.printerId) {
    await prisma.printer.update({
      where: { id: updatedNode.printerId },
      data: {
        heartbeatStatus: body.heartbeatStatus,
        status: body.printerStatus,
        cameraStatus: body.cameraStatus,
        lastHeartbeatAt: heartbeatAt,
        healthDescription: body.lastError ?? "SuperNode heartbeat received"
      }
    });
  }

  return NextResponse.json({ accepted: true, nodeId: updatedNode.nodeId });
}
