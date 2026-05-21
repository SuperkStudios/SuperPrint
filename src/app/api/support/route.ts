import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { createSupportTicket, listCustomerTickets } from "@/services/support";

const supportSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000)
});

export async function GET() {
  const { session, response } = await requireCustomer();
  if (response) return response;
  return NextResponse.json({ tickets: await listCustomerTickets(session!.user.id) });
}

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  try {
    const body = supportSchema.parse(await request.json());
    const ticket = await createSupportTicket({
      userId: session!.user.id,
      subject: body.subject,
      message: body.message
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start support thread." }, { status: 400 });
  }
}
