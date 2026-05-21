import { NextResponse } from "next/server";
import { SupportTicketStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/http";
import { listAdminTickets } from "@/services/support";

export async function GET(request: Request) {
  const { response } = await requireAdmin("support");
  if (response) return response;
  const status = new URL(request.url).searchParams.get("status");
  const parsed = status && status in SupportTicketStatus ? status as SupportTicketStatus : "ALL";
  return NextResponse.json({ tickets: await listAdminTickets(parsed) });
}
