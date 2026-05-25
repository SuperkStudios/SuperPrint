import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { registerMobilePushToken } from "@/services/mobile-push";

const schema = z.object({
  token: z.string().trim().min(12),
  platform: z.string().trim().min(2).max(32),
  deviceName: z.string().trim().max(120).optional().nullable(),
  appVersion: z.string().trim().max(40).optional().nullable()
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("products");
  if (response) return response;
  if (!session?.user.id) return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  const body = schema.parse(await request.json());
  const token = await registerMobilePushToken({
    userId: session.user.id,
    token: body.token,
    platform: body.platform,
    deviceName: body.deviceName,
    appVersion: body.appVersion
  });
  return NextResponse.json({ token: { id: token.id, enabled: token.enabled, lastSeenAt: token.lastSeenAt } });
}
