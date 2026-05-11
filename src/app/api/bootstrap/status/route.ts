import { NextResponse } from "next/server";
import { getBootstrapStatus } from "@/lib/bootstrap";

export async function GET() {
  const status = await getBootstrapStatus();
  return NextResponse.json({
    isComplete: status.isComplete,
    canBootstrap: status.canBootstrap
  });
}
