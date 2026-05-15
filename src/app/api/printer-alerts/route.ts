import { NextResponse } from "next/server";
import { z } from "zod";
import { handlePrintAnomaly } from "@/services/printer-alerts";

export const runtime = "nodejs";

const alertSchema = z.object({
  printJobId: z.string(),
  printerId: z.string(),
  type: z.enum(["SPAGHETTI", "WRONG_PRINT", "LAYER_SHIFT", "THERMAL", "UNKNOWN"]),
  confidence: z.number().min(0).max(1)
});

export async function POST(request: Request) {
  const expectedToken = process.env.PRINTER_ALERT_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "Printer alert webhook token is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-superprint-alert-token") !== expectedToken) {
    return NextResponse.json({ error: "Invalid printer alert token" }, { status: 401 });
  }

  const body = alertSchema.parse(await request.json());
  return NextResponse.json(await handlePrintAnomaly(body));
}
