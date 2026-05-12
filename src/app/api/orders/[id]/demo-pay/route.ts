import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/http";
import { markOrderPaidAndQueue } from "@/services/checkout";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const { id } = await params;
  const order = await markOrderPaidAndQueue(id, session!.user.id);
  return NextResponse.json({ order });
}
