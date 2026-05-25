import { notificationSettingKeys, resolveNotificationSettings } from "@/domain/notification-settings";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "./events";
import { sendMobilePush } from "./mobile-push";

export type OperationsAlert = {
  title: string;
  message: string;
  severity: "watch" | "warning" | "critical";
  printerId?: string;
  printJobId?: string;
};

export async function sendOperationsAlert(alert: OperationsAlert) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: notificationSettingKeys() } }
  });
  const resolved = resolveNotificationSettings(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));

  await recordPlatformEvent({
    type: "MAINTENANCE_DUE",
    payload: {
      ...alert,
      notificationTargets: {
        email: Boolean(resolved.email),
        sms: Boolean(resolved.sms),
        webhook: Boolean(resolved.webhookUrl)
      }
    }
  });

  if (resolved.webhookUrl) {
    await fetch(resolved.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);
  }

  await sendMobilePush({
    title: alert.title,
    body: alert.message,
    data: {
      severity: alert.severity,
      printerId: alert.printerId ?? null,
      printJobId: alert.printJobId ?? null
    }
  });
}
