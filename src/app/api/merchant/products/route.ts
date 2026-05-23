import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantUser } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  priceCents: z.number().int().positive(),
  active: z.boolean()
});

export async function GET() {
  const { session, response } = await requireMerchantUser();
  if (response) return response;
  const products = await prisma.merchantProduct.findMany({
    where: { merchantUserId: session.user.id },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const { session, application, response } = await requireMerchantUser();
  if (response) return response;

  try {
    const body = productSchema.parse(await request.json());
    const product = body.id
      ? await prisma.merchantProduct.update({
          where: { id: body.id, merchantUserId: session.user.id },
          data: { name: body.name, priceCents: body.priceCents, active: body.active }
        })
      : await prisma.merchantProduct.create({
          data: {
            merchantUserId: session.user.id,
            applicationId: application?.id,
            name: body.name,
            priceCents: body.priceCents,
            active: body.active
          }
        });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save merchant product." }, { status: 400 });
  }
}
