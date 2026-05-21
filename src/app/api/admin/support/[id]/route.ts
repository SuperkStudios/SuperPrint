import { NextResponse } from "next/server";
import { SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { addAdminTicketReply, getAdminTicket, updateSupportTicketStatus } from "@/services/support";

const updateSchema = z.object({
  action: z.enum(["reply", "status"]),
  message: z.string().trim().max(4000).optional(),
  status: z.nativeEnum(SupportTicketStatus).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin("support");
  if (response) return response;
  const { id } = await params;
  const ticket = await getAdminTicket(id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin("support");
  if (response) return response;
  const { id } = await params;
  const body = updateSchema.parse(await request.json());
  try {
    if (body.action === "status") {
      if (!body.status) return NextResponse.json({ error: "Status required" }, { status: 400 });
      return NextResponse.json({ ticket: await updateSupportTicketStatus({ ticketId: id, status: body.status, actorId: session?.user.id, note: body.message || null }) });
    }
    if (!body.message) return NextResponse.json({ error: "Message required" }, { status: 400 });
    return NextResponse.json({ ticket: await addAdminTicketReply({ adminId: session?.user.id ?? null, ticketId: id, message: body.message }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update ticket." }, { status: 400 });
  }
}
