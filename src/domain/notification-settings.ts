export type NotificationSettings = {
  email: string;
  sms: string;
  webhookUrl: string;
  configured: boolean;
};

export function notificationSettingKeys() {
  return ["notifications.email", "notifications.sms", "notifications.webhookUrl"];
}

export function resolveNotificationSettings(values: Record<string, unknown>): NotificationSettings {
  const email = stringSetting(values["notifications.email"]);
  const sms = stringSetting(values["notifications.sms"]);
  const webhookUrl = stringSetting(values["notifications.webhookUrl"]);
  return {
    email,
    sms,
    webhookUrl,
    configured: Boolean(email || sms || webhookUrl)
  };
}

export function buildNotificationSettingsUpdate(input: { email?: string; sms?: string; webhookUrl?: string }) {
  const updates: Record<string, string> = {};
  add(updates, "notifications.email", input.email);
  add(updates, "notifications.sms", input.sms);
  add(updates, "notifications.webhookUrl", input.webhookUrl);
  return updates;
}

export function publicNotificationSettings(values: Record<string, unknown>) {
  return resolveNotificationSettings(values);
}

function add(updates: Record<string, string>, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) updates[key] = trimmed;
}

function stringSetting(value: unknown) {
  return typeof value === "string" ? value : "";
}
