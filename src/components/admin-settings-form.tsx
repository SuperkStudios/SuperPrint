"use client";

import { useEffect, useState } from "react";
import { buildThemeCssVariables, normalizePrimaryColor } from "@/domain/theme";
import { maskStripeSecret } from "@/domain/stripe-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicStripeSettings = {
  mode: "test" | "live";
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  configured: boolean;
  source?: "admin" | "env" | "none";
};

type PublicNotificationSettings = {
  email: string;
  sms: string;
  webhookUrl: string;
  configured: boolean;
};

export function AdminSettingsForm({
  brandName,
  primaryColor,
  lowFilamentThresholdGrams,
  stripeSettings = {
    mode: "test",
    secretKey: "",
    publishableKey: "",
    webhookSecret: "",
    configured: false,
    source: "none"
  },
  notificationSettings = {
    email: "",
    sms: "",
    webhookUrl: "",
    configured: false
  }
}: {
  brandName: string;
  primaryColor: string;
  lowFilamentThresholdGrams: number;
  stripeSettings?: PublicStripeSettings;
  notificationSettings?: PublicNotificationSettings;
}) {
  const [draft, setDraft] = useState({
    brandName,
    primaryColor,
    lowFilamentThresholdGrams,
    stripe: {
      ...stripeSettings,
      secretKey: maskStripeSecret(stripeSettings.secretKey),
      webhookSecret: maskStripeSecret(stripeSettings.webhookSecret)
    },
    notifications: notificationSettings
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const variables = buildThemeCssVariables(draft.primaryColor);
    for (const [key, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [draft.primaryColor]);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Settings saved" : result.error ?? "Settings blocked");
  }

  return (
    <div className="grid gap-5 rounded-lg border bg-white p-5 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="brand-name">Public brand name</Label>
        <Input id="brand-name" value={draft.brandName} onChange={(event) => setDraft((current) => ({ ...current, brandName: event.target.value }))} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="admin-primary-color">Primary color</Label>
        <div className="flex gap-2">
          <Input
            id="admin-primary-color"
            type="color"
            value={normalizePrimaryColor(draft.primaryColor)}
            onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))}
            className="h-10 w-16 p-1"
          />
          <Input value={draft.primaryColor} onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="low-filament-threshold">Low filament alert grams</Label>
        <Input
          id="low-filament-threshold"
          type="number"
          value={draft.lowFilamentThresholdGrams}
          onChange={(event) => setDraft((current) => ({ ...current, lowFilamentThresholdGrams: Number(event.target.value) }))}
        />
      </div>

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="font-semibold">Stripe payments</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-entered keys override environment variables for checkout and webhook verification.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stripe-mode">Stripe mode</Label>
          <select
            id="stripe-mode"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.stripe.mode}
            onChange={(event) => setDraft((current) => ({ ...current, stripe: { ...current.stripe, mode: event.target.value as "test" | "live" } }))}
          >
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stripe-publishable-key">Publishable key</Label>
          <Input
            id="stripe-publishable-key"
            value={draft.stripe.publishableKey}
            placeholder="pk_test_..."
            onChange={(event) => setDraft((current) => ({ ...current, stripe: { ...current.stripe, publishableKey: event.target.value } }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stripe-secret-key">Secret key</Label>
          <Input
            id="stripe-secret-key"
            value={draft.stripe.secretKey}
            placeholder="sk_test_..."
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, stripe: { ...current.stripe, secretKey: event.target.value } }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stripe-webhook-secret">Webhook signing secret</Label>
          <Input
            id="stripe-webhook-secret"
            value={draft.stripe.webhookSecret}
            placeholder="whsec_..."
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, stripe: { ...current.stripe, webhookSecret: event.target.value } }))}
          />
        </div>
      </div>

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-3">
        <div className="md:col-span-3">
          <h3 className="font-semibold">Operations notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts are sent when prints fail, spaghetti is detected, maintenance is due, or filament changes are needed.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notification-email">Alert email</Label>
          <Input
            id="notification-email"
            type="email"
            value={draft.notifications.email}
            placeholder="owner@example.com"
            onChange={(event) => setDraft((current) => ({ ...current, notifications: { ...current.notifications, email: event.target.value } }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notification-sms">Alert phone</Label>
          <Input
            id="notification-sms"
            value={draft.notifications.sms}
            placeholder="+15555550123"
            onChange={(event) => setDraft((current) => ({ ...current, notifications: { ...current.notifications, sms: event.target.value } }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notification-webhook">Webhook URL</Label>
          <Input
            id="notification-webhook"
            value={draft.notifications.webhookUrl}
            placeholder="https://..."
            onChange={(event) => setDraft((current) => ({ ...current, notifications: { ...current.notifications, webhookUrl: event.target.value } }))}
          />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
