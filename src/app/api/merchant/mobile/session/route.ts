import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({
  mode: z.enum(["signIn", "signUp"]),
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, z.string().min(1).optional())
});

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "merchant-mobile-session", limit: 20, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    const user = body.mode === "signUp" ? await createUser(email, body.password, body.name) : await verifyUser(email, body.password);
    if (!user.emailVerified && process.env.NODE_ENV === "production" && process.env.MERCHANT_MOBILE_ALLOW_UNVERIFIED_EMAIL !== "true") {
      return NextResponse.json({ error: "Verify your email before using the merchant app." }, { status: 403 });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await prisma.session.create({
      data: {
        token,
        expiresAt,
        userId: user.id,
        userAgent: request.headers.get("user-agent") ?? "SuperPrint Merchant"
      }
    });
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign in." }, { status: 400 });
  }
}

async function createUser(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists.");
  const passwordHash = await hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      name: name || email.split("@")[0] || "Merchant",
      emailVerified: process.env.NODE_ENV !== "production" || process.env.MERCHANT_MOBILE_ALLOW_UNVERIFIED_EMAIL === "true",
      passwordHash,
      accounts: {
        create: {
          providerId: "credential",
          accountId: email,
          password: passwordHash
        }
      }
    },
    select: { id: true, email: true, name: true, emailVerified: true }
  });
}

async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { providerId: "credential" }, take: 1 } }
  });
  const passwordHash = user?.accounts[0]?.password ?? user?.passwordHash;
  if (!user || !passwordHash || !(await compare(password, passwordHash))) {
    throw new Error("Invalid email or password.");
  }
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
}
