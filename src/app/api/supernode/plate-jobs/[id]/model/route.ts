import { NextResponse } from "next/server";
import { readProductionPlateModel } from "@/services/production-plates";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    const { fileName, file } = await readProductionPlateModel(id, nodeId, bearer);
    return new NextResponse(file, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Plate model is not available to this node" }, { status: 404 });
  }
}
