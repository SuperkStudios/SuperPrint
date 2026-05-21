import { NextResponse } from "next/server";
import { SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { addCustomerTicketReply, getCustomerTicket, updateSupportTicketStatus } from "@/services/support";

const replySchema = z.object({
  action: z.enum(["reply", "close", "reopen"]).default("reply"),
  message: z.string().trim().min(1).max(4000).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const { id } = await params;
  const ticket = await getCustomerTicket(session!.user.id, id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const { id } = await params;
  const body = replySchema.parse(await request.json());
  try {
    if (body.action === "close") {
      return NextResponse.json({ ticket: await updateSupportTicketStatus({ ticketId: id, status: SupportTicketStatus.CLOSED, actorId: session!.user.id, note: body.message ?? "Customer closed the ticket." }) });
    }
    if (body.action === "reopen") {
      return NextResponse.json({ ticket: await updateSupportTicketStatus({ ticketId: id, status: SupportTicketStatus.AWAITING_ADMIN, actorId: session!.user.id, note: body.message ?? "Customer reopened the ticket." }) });
    }
    if (!body.message) return NextResponse.json({ error: "Message required" }, { status: 400 });
    return NextResponse.json({ ticket: await addCustomerTicketReply({ userId: session!.user.id, ticketId: id, message: body.message }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update ticket." }, { status: 400 });
  }
}
