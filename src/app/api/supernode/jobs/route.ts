import { NextResponse } from "next/server";
import { listPrinterReadyJobsForNode } from "@/services/supernode-jobs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    return NextResponse.json({ jobs: await listPrinterReadyJobsForNode(nodeId, bearer) });
  } catch {
    return NextResponse.json({ error: "Invalid SuperNode credentials" }, { status: 401 });
  }
}
