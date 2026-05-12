import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    online: false,
    snapshotUrl: null,
    message: "Snapshot capture will be available when the local stream relay publishes thumbnails."
  });
}
