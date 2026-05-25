import { NextResponse } from "next/server";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeCustomerOrder } from "../_lib";

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;
  const orders = await prisma.order.findMany({
    where: { customerId: session!.user.id },
    include: {
      product: true,
      upload: true,
      items: { include: { product: true } },
      printJobs: { include: { printer: true }, orderBy: { createdAt: "asc" } },
      videos: true
    },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ orders: orders.map(serializeCustomerOrder) });
}
