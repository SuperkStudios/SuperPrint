import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function GET(request: Request) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(25, Math.max(1, Number(url.searchParams.get("limit") ?? 12)));
  const dbCustomers = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { stripeCustomerId: { contains: query, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: {
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, totalCents: true }
      }
    },
    orderBy: { updatedAt: "desc" },
    take
  });

  const customers = new Map<string, {
    id: string;
    name: string;
    email: string;
    stripeCustomerId: string | null;
    source: "superprint" | "stripe";
    orderCount: number;
    lastOrderAt: string | null;
  }>();

  for (const customer of dbCustomers) {
    customers.set(customer.email.toLowerCase(), {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      stripeCustomerId: customer.stripeCustomerId,
      source: "superprint",
      orderCount: customer._count.orders,
      lastOrderAt: customer.orders[0]?.createdAt.toISOString() ?? null
    });
  }

  const stripe = await getStripe();
  if (stripe && query) {
    const stripeCustomers = await stripe.customers.search({
      query: `email~'${escapeStripeSearch(query)}' OR name~'${escapeStripeSearch(query)}'`,
      limit: take
    }).catch(() => null);
    for (const stripeCustomer of stripeCustomers?.data ?? []) {
      const email = stripeCustomer.email?.toLowerCase();
      if (!email || customers.has(email)) continue;
      customers.set(email, {
        id: stripeCustomer.id,
        name: stripeCustomer.name ?? stripeCustomer.email ?? "Stripe customer",
        email: stripeCustomer.email ?? "",
        stripeCustomerId: stripeCustomer.id,
        source: "stripe",
        orderCount: 0,
        lastOrderAt: null
      });
    }
  }

  return NextResponse.json({ customers: [...customers.values()].slice(0, take) });
}

function escapeStripeSearch(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
