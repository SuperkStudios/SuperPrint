import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const orderActionSchema = z.object({
  orderId: z.string(),
  action: z.enum(["markPacking", "markShipped", "markDelivered"])
});

const shippingStatusByAction = {
  markPacking: "PACKING",
  markShipped: "SHIPPED",
  markDelivered: "DELIVERED"
} as const;

export async function GET() {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const orders = await prisma.order.findMany({
    include: { customer: true, product: true, upload: true, printJobs: { include: { filament: true, printer: true } } },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const body = orderActionSchema.parse(await request.json());
  const order = await prisma.order.update({
    where: { id: body.orderId },
    data: { shippingStatus: shippingStatusByAction[body.action] }
  });
  return NextResponse.json({ order });
}
