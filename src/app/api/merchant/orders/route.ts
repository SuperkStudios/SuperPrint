import { NextResponse } from "next/server";
import { requireMerchantUser } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, response } = await requireMerchantUser();
  if (response) return response;
  const orders = await prisma.merchantOrder.findMany({
    where: { merchantUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json({ orders });
}
