import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "./events";

export type MobilePushInput = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  userId?: string | null;
};

export async function registerMobilePushToken(input: {
  userId: string;
  token: string;
  platform: string;
  deviceName?: string | null;
  appVersion?: string | null;
}) {
  return prisma.mobilePushToken.upsert({
    where: { token: input.token },
    update: {
      userId: input.userId,
      platform: input.platform,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
      enabled: true,
      lastSeenAt: new Date()
    },
    create: {
      userId: input.userId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName,
      appVersion: input.appVersion
    }
  });
}

export async function sendMobilePush(input: MobilePushInput) {
  const tokens = await prisma.mobilePushToken.findMany({
    where: {
      enabled: true,
      user: input.userId ? { id: input.userId } : { role: { in: ["OWNER", "ADMIN", "STAFF"] } }
    },
    select: { id: true, token: true }
  });
  if (!tokens.length) return { sent: 0, failed: 0 };

  const messages = tokens.map((token) => ({
    to: token.token,
    sound: "default",
    title: input.title,
    body: input.body,
    data: input.data ?? {}
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate"
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.json().catch(() => null) as { data?: Array<{ status?: string; message?: string }> } | null;
    const failedIndexes = new Set<number>();
    body?.data?.forEach((ticket, index) => {
      if (ticket.status === "error") failedIndexes.add(index);
    });
    if (!response.ok) {
      tokens.forEach((_token, index) => failedIndexes.add(index));
    }
    if (failedIndexes.size) {
      await prisma.mobilePushToken.updateMany({
        where: { id: { in: tokens.filter((_token, index) => failedIndexes.has(index)).map((token) => token.id) } },
        data: { enabled: false }
      });
    }
    await recordPlatformEvent({
      type: failedIndexes.size ? "MOBILE_PUSH_FAILED" : "MOBILE_PUSH_SENT",
      payload: { title: input.title, sent: tokens.length - failedIndexes.size, failed: failedIndexes.size }
    });
    return { sent: tokens.length - failedIndexes.size, failed: failedIndexes.size };
  } catch (error) {
    await recordPlatformEvent({
      type: "MOBILE_PUSH_FAILED",
      payload: { title: input.title, failed: tokens.length, error: error instanceof Error ? error.message : String(error) }
    });
    return { sent: 0, failed: tokens.length };
  }
}
