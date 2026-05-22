import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/http";
import { recordPlatformEvent } from "@/services/events";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { createProductCheckout } from "@/services/checkout";
import { buildStripeCheckoutSuccessUrl } from "@/domain/checkout";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";

const createOrderSchema = z.object({
  productId: z.string().optional(),
  uploadId: z.string().optional(),
  selectedFilamentMaterialId: z.string().optional(),
  selectedFilamentMaterialIds: z.array(z.string()).optional(),
  selectedMaterial: z.string().optional(),
  selectedColor: z.string().optional(),
  selectedColors: z.array(z.string()).optional(),
  fulfillment: z.object({
    method: z.enum(["SHIP", "PICKUP"]),
    address: z.object({
      name: z.string().optional(),
      street1: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional()
    }).optional()
  }).optional()
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
    try {
      const checkout = await createProductCheckout({
        productId: body.productId,
        customerId: session!.user.id,
        customerEmail: session!.user.email,
        selectedFilamentMaterialId: body.selectedFilamentMaterialId,
        selectedFilamentMaterialIds: body.selectedFilamentMaterialIds,
        selectedMaterial: body.selectedMaterial,
        selectedColor: body.selectedColor,
        selectedColors: body.selectedColors,
        fulfillment: body.fulfillment ?? { method: "SHIP" }
      });
      return NextResponse.json(checkout, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 400 });
    }
  }
  if (!body.uploadId) {
    return NextResponse.json({ error: "Choose a product or upload before checkout." }, { status: 400 });
  }

  const [upload, stripe] = await Promise.all([
    prisma.modelUpload.findUnique({ where: { id: body.uploadId } }),
    getStripe()
  ]);
  if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  if (!stripe) return NextResponse.json({ error: "Stripe payments are not configured. Add Stripe keys in admin settings before accepting checkout payments." }, { status: 400 });

  const totalCents = upload.estimatedPriceCents ?? 0;
  if (totalCents <= 0) {
    return NextResponse.json({ error: "This upload needs an approved price before checkout." }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: `SP-${Date.now().toString().slice(-6)}`,
      customerId: session!.user.id,
      uploadId: upload.id,
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

  const baseUrl = getStripeBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session!.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: upload.fileName ? `Custom print: ${upload.fileName}` : "Custom SuperPrint upload"
          },
          unit_amount: totalCents
        },
        quantity: 1
      }
    ],
    metadata: {
      orderId: order.id,
      uploadId: upload.id,
      customerId: session!.user.id
    },
    success_url: buildStripeCheckoutSuccessUrl(baseUrl, order.id),
    cancel_url: `${baseUrl}/store?checkout=cancelled`
  });

  return NextResponse.json({ order, checkoutUrl: checkout.url, stripeConfigured: true }, { status: 201 });
}
