import { NextResponse } from "next/server";
import { getPublicQueueState } from "@/services/queue";
import { getBootstrapStatus } from "@/lib/bootstrap";

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  return NextResponse.json(await getPublicQueueState());
}
