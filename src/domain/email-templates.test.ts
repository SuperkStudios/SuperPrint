import { describe, expect, it } from "vitest";
import { buildEmailSettingsUpdate, resolveEmailSettings } from "./email-templates";

describe("email settings", () => {
  it("defaults transactional senders to print.superk.studio addresses", () => {
    const settings = resolveEmailSettings();

    expect(settings.noreplyFrom).toBe("noreply@print.superk.studio");
    expect(settings.supportFrom).toBe("support@print.superk.studio");
  });

  it("normalizes sender fields to plain print.superk.studio mailboxes", () => {
    expect(resolveEmailSettings({ "email.noreplyFrom": "SuperPrint <NoReply@print.superk.studio>" }).noreplyFrom).toBe("noreply@print.superk.studio");
    expect(buildEmailSettingsUpdate({ supportFrom: "support" })).toMatchObject({
      "email.supportFrom": "support@print.superk.studio"
    });
  });
});
