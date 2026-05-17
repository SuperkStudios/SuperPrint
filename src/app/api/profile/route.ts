import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1),
  image: z.string().trim().url().optional().or(z.literal("")),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional(),
  shippingName: z.string().trim().max(120).optional().or(z.literal("")),
  shippingStreet1: z.string().trim().max(160).optional().or(z.literal("")),
  shippingStreet2: z.string().trim().max(160).optional().or(z.literal("")),
  shippingCity: z.string().trim().max(100).optional().or(z.literal("")),
  shippingState: z.string().trim().max(40).optional().or(z.literal("")),
  shippingZip: z.string().trim().max(20).optional().or(z.literal("")),
  shippingCountry: z.string().trim().max(2).optional().or(z.literal("")),
  shippingPhone: z.string().trim().max(40).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const body = schema.parse(await request.json());
  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: {
      name: body.name,
      image: body.image || null,
      username: body.username || null,
      bio: body.bio || null,
      shippingName: body.shippingName || null,
      shippingStreet1: body.shippingStreet1 || null,
      shippingStreet2: body.shippingStreet2 || null,
      shippingCity: body.shippingCity || null,
      shippingState: body.shippingState || null,
      shippingZip: body.shippingZip || null,
      shippingCountry: body.shippingCountry || "US",
      shippingPhone: body.shippingPhone || null
    }
  });
  return NextResponse.json({ user });
}
