import { NextResponse } from "next/server";
import { authenticateSuperNode } from "@/services/supernode-jobs";
import { saveSuperNodeCameraFrame } from "@/services/supernode-camera-frames";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxFrameBytes = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const nodeId = request.headers.get("x-supernode-id") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const node = await authenticateSuperNode(nodeId, bearer).catch(() => null);
  if (!node) {
    return NextResponse.json({ error: "Invalid SuperNode credentials" }, { status: 401 });
  }
  const printerId = request.headers.get("x-supernode-printer-id") || node.printerId;
  if (!printerId || printerId !== node.printerId) {
    return NextResponse.json({ error: "SuperNode is not assigned to this printer" }, { status: 403 });
  }

  const frame = new Uint8Array(await request.arrayBuffer());
  if (frame.byteLength < 4 || frame.byteLength > maxFrameBytes || !isJpeg(frame)) {
    return NextResponse.json({ error: "Camera frame must be a JPEG under 2MB" }, { status: 400 });
  }

  saveSuperNodeCameraFrame({
    printerId,
    nodeId: node.nodeId,
    frame,
    contentType: request.headers.get("content-type")
  });

  return NextResponse.json({ accepted: true });
}

function isJpeg(frame: Uint8Array) {
  return frame[0] === 0xff && frame[1] === 0xd8 && frame[frame.byteLength - 2] === 0xff && frame[frame.byteLength - 1] === 0xd9;
}
