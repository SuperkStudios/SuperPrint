import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeUser } from "../_lib";

export { POST } from "../../profile/route";

export async function GET() {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const user = await prisma.user.findUniqueOrThrow({
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
  });
  return NextResponse.json({ user: serializeUser(user) });
}
