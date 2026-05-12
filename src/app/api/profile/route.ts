import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1),
  image: z.string().trim().url().optional().or(z.literal("")),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional()
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
      bio: body.bio || null
    }
  });
  return NextResponse.json({ user });
}
