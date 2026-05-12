import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { refreshAllPrinterHeartbeats } from "@/services/printer-heartbeat";

export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const printers = await refreshAllPrinterHeartbeats();
  return NextResponse.json({
    printers: printers.map((printer) => ({
      id: printer.id,
      publicName: printer.publicName,
      heartbeatStatus: printer.heartbeatStatus,
      status: printer.status,
      lastHeartbeatAt: printer.lastHeartbeatAt,
      heartbeatLatencyMs: printer.heartbeatLatencyMs,
      healthDescription: printer.healthDescription
    }))
  });
}
