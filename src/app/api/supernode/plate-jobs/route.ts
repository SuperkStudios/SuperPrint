import { NextResponse } from "next/server";
import { listProductionPlateJobsForNode } from "@/services/production-plates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    return NextResponse.json({ jobs: await listProductionPlateJobsForNode(nodeId, bearer) });
  } catch {
    return NextResponse.json({ error: "Invalid SuperNode credentials" }, { status: 401 });
  }
}
