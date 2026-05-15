import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { staffPermissions } from "@/domain/navigation";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const staffSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["STAFF", "ADMIN"]).default("STAFF"),
  permissions: z.array(z.enum(staffPermissions)).default([])
});

export async function GET() {
  const { response } = await requireAdmin("staff");
  if (response) return response;

  const staff = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN", "STAFF"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin("staff");
  if (response) return response;

  const body = staffSchema.parse(await request.json());
  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  const staffPermissionsValue = body.role === "ADMIN" ? [...staffPermissions] : body.permissions;

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: body.name, role: body.role, staffPermissions: staffPermissionsValue }
    });
    return NextResponse.json({ user });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hash(temporaryPassword, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      emailVerified: true,
      role: body.role,
      staffPermissions: staffPermissionsValue,
      passwordHash,
      accounts: {
        create: {
          accountId: body.email.toLowerCase(),
          providerId: "credential",
          password: passwordHash
        }
      }
    }
  });

  return NextResponse.json({ user, temporaryPassword }, { status: 201 });
}

function generateTemporaryPassword() {
  return `SuperPrint-${crypto.randomUUID().slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;
}
