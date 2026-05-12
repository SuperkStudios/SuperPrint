import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/http";
import { recordPlatformEvent } from "@/services/events";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { createProductCheckout } from "@/services/checkout";

const createOrderSchema = z.object({
  productId: z.string().optional(),
  uploadId: z.string().optional()
});

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const orders = await prisma.order.findMany({
    where: { customerId: session!.user.id },
    include: { product: true, upload: true, printJobs: true, videos: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const body = createOrderSchema.parse(await request.json());
  if (body.productId) {
    const checkout = await createProductCheckout({
      productId: body.productId,
      customerId: session!.user.id,
      customerEmail: session!.user.email
    });
    return NextResponse.json(checkout, { status: 201 });
  }
  const product = body.productId ? await prisma.product.findUnique({ where: { id: body.productId } }) : null;
  const upload = body.uploadId ? await prisma.modelUpload.findUnique({ where: { id: body.uploadId } }) : null;
  const totalCents = product?.priceCents ?? upload?.estimatedPriceCents ?? 0;

  const order = await prisma.order.create({
    data: {
      orderNumber: `SP-${Date.now().toString().slice(-6)}`,
      customerId: session!.user.id,
      productId: product?.id,
      uploadId: upload?.id,
      totalCents,
      status: "CHECKOUT_READY",
      paymentStatus: "PENDING"
    }
  });

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId: session!.user.id,
    payload: { orderNumber: order.orderNumber, customerEmail: session!.user.email }
  });

  // TODO: Create payment provider checkout session and store provider IDs server-side.
  // TODO: Create shipping quotes and labels after successful payment.
  return NextResponse.json({ order, checkoutReady: true }, { status: 201 });
}
