import { NextResponse } from "next/server";
import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const queue = await getPublicQueueState();
  const printer = queue.current?.printer ?? queue.printers[0] ?? null;

  return NextResponse.json({
    online: Boolean(process.env.PRINTER_HLS_URL),
    streamUrl: "/api/live/printer/main.m3u8",
    printerName: printer?.name ?? "SuperPrint cell",
    health: printer?.healthDescription ?? "No public printer status available",
    recording: false,
    latencyMode: "low-latency-hls"
  });
}
