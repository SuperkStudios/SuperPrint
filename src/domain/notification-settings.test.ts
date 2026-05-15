import { describe, expect, it } from "vitest";
import { buildNotificationSettingsUpdate, resolveNotificationSettings } from "./notification-settings";

describe("notification settings", () => {
  it("resolves admin notification channels from SystemSetting values", () => {
    expect(
      resolveNotificationSettings({
        "notifications.email": "owner@example.com",
        "notifications.sms": "+15555550123",
        "notifications.webhookUrl": "https://hooks.example.com/superprint"
      })
    ).toEqual({
      email: "owner@example.com",
      sms: "+15555550123",
      webhookUrl: "https://hooks.example.com/superprint",
      configured: true
    });
  });

  it("builds sparse updates for enabled notification channels", () => {
    expect(
      buildNotificationSettingsUpdate({
        email: "owner@example.com",
        sms: "",
        webhookUrl: "https://hooks.example.com/superprint"
      })
    ).toEqual({
      "notifications.email": "owner@example.com",
      "notifications.webhookUrl": "https://hooks.example.com/superprint"
    });
  });
});
