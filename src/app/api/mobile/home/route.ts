import { NextResponse } from "next/server";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { summarizeCart } from "@/services/cart";
import { getRewardsSummary } from "@/services/rewards";
import { serializeCustomerOrder, serializeUser } from "../_lib";

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;
  const [user, cart, rewards, orders, application, supportOpen] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session!.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        username: true,
        bio: true,
        rewardsPointsBalance: true,
        shippingName: true,
        shippingStreet1: true,
        shippingStreet2: true,
        shippingCity: true,
        shippingState: true,
        shippingZip: true,
        shippingCountry: true,
        shippingPhone: true
      }
    }),
    summarizeCart(session!.user.id),
    getRewardsSummary(session!.user.id),
    prisma.order.findMany({
      where: { customerId: session!.user.id },
      include: {
        product: true,
        upload: true,
        items: { include: { product: true } },
        printJobs: { include: { printer: true }, orderBy: { createdAt: "asc" } },
        videos: true
      },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.merchantApplication.findFirst({
      where: { userId: session!.user.id },
      orderBy: { updatedAt: "desc" },
      include: { documents: true }
    }),
    prisma.supportTicket.count({
      where: { customerId: session!.user.id, status: { not: "CLOSED" } }
    })
  ]);
  const serializedOrders = orders.map(serializeCustomerOrder);
  return NextResponse.json({
    user: serializeUser(user),
    cart,
    rewards,
    orders: serializedOrders,
    activePrints: serializedOrders.filter((order) => order.printJobs.some((job) => ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"].includes(job.status))),
    merchantApplication: application,
    supportOpen
  });
}
