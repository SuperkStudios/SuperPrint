import { NextResponse } from "next/server";
import { getPublicQueueState } from "@/services/queue";

export async function GET() {
  return NextResponse.json(await getPublicQueueState());
}
