import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

const resendSchema = z.object({
  email: z.string().email(),
  callbackURL: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await auth.api.sendVerificationEmail({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        callbackURL: safeCallbackPath(parsed.data.callbackURL)
      }
    });
  } catch {
    // Keep this response generic so the endpoint cannot confirm whether an email has an account.
  }

  return NextResponse.json({ status: true });
}

function safeCallbackPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
