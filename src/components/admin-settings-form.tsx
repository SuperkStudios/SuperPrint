"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { buildThemeCssVariables, normalizePrimaryColor } from "@/domain/theme";
import { maskStripeSecret } from "@/domain/stripe-settings";
import { defaultShippoPrintCommand, maskShippoSecret } from "@/domain/shippo-settings";
import { stripeStandardPaymentProcessingFixedCents, stripeStandardPaymentProcessingPercent } from "@/domain/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicStripeSettings = {
  mode: "test" | "live";
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  terminalLocationId: string;
  configured: boolean;
  source?: "admin" | "env" | "none";
};

type PublicNotificationSettings = {
  email: string;
  sms: string;
  webhookUrl: string;
  configured: boolean;
};

type PublicEmailSettings = {
  cloudflareAccountId: string;
  apiKey: string;
  noreplyFrom: string;
  supportFrom: string;
  brandName: string;
  headerImageUrl: string;
  footerNote: string;
  headerHtml: string;
  footerHtml: string;
  templates: Array<{
    id: string;
    label: string;
    description: string;
    subject: string;
    text: string;
    html: string;
  }>;
};

type PublicShippoSettings = {
  apiToken: string;
  configured: boolean;
  source?: "admin" | "env" | "none";
  freeShippingThresholdCents: number | null;
  pickupCity: string;
  pickupState: string;
  autoCreateLabelAfterPrint: boolean;
  autoPrintLabelAfterPrint: boolean;
  printCommand: string;
  labelFileType: "PDF" | "PNG" | "PDF_4x6" | "ZPLII";
  originAddress: {
    name: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string | null;
    email?: string | null;
  } | null;
};

type PublicPricingSettings = {
  taxPercentEstimate?: number | null;
};

type PublicRewardsSettings = {
  pointsPerDollar: number;
  redemptionPointsPerDollar: number;
  maxDiscountPercent: number;
  minimumRedemptionPoints: number;
  earnOnDiscountedAmount: boolean;
  includeShippingInEarnBasis: boolean;
  reservationTtlMinutes: number;
};
type NumericRewardsField = Exclude<keyof PublicRewardsSettings, "earnOnDiscountedAmount" | "includeShippingInEarnBasis">;

type AdminSettingsDraft = {
  brandName: string;
  primaryColor: string;
  lowFilamentThresholdGrams: number;
  stripe: PublicStripeSettings;
  shippo: PublicShippoSettings;
  notifications: PublicNotificationSettings;
  email: PublicEmailSettings;
  pricing: PublicPricingSettings;
  rewards: PublicRewardsSettings;
};

const defaultPricingSettings: PublicPricingSettings = {
  taxPercentEstimate: null
};

const defaultRewardsSettings: PublicRewardsSettings = {
  pointsPerDollar: 10,
  redemptionPointsPerDollar: 100,
  maxDiscountPercent: 0.2,
  minimumRedemptionPoints: 500,
  earnOnDiscountedAmount: true,
  includeShippingInEarnBasis: false,
  reservationTtlMinutes: 60
};

const defaultEmailSettings: PublicEmailSettings = {
  cloudflareAccountId: "",
  apiKey: "",
  noreplyFrom: "noreply@print.superk.studio",
  supportFrom: "support@print.superk.studio",
  brandName: "SuperPrint",
  headerImageUrl: "/brand/email-factory-banner.png",
  footerNote: "Live manufacturing. Transparent by design.",
  headerHtml: buildEmailHeaderHtml("{{brandName}}", "{{headerImageUrl}}", "{{footerNote}}"),
  footerHtml: buildEmailFooterHtml("{{brandName}}", "{{supportEmail}}", "{{footerNote}}"),
  templates: []
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
    terminalLocationId: "",
    configured: false,
    source: "none"
  },
  shippoSettings = {
    apiToken: "",
    configured: false,
    source: "none",
    freeShippingThresholdCents: null,
    pickupCity: "Fort Collins",
    pickupState: "CO",
    autoCreateLabelAfterPrint: false,
    autoPrintLabelAfterPrint: false,
    printCommand: defaultShippoPrintCommand,
    labelFileType: "PDF_4x6",
    originAddress: null
  },
  notificationSettings = {
    email: "",
    sms: "",
    webhookUrl: "",
    configured: false
  },
  emailSettings = defaultEmailSettings,
  pricingSettings = defaultPricingSettings,
  rewardsSettings = defaultRewardsSettings
}: {
  brandName: string;
  primaryColor: string;
  lowFilamentThresholdGrams: number;
  stripeSettings?: PublicStripeSettings;
  shippoSettings?: PublicShippoSettings;
  notificationSettings?: PublicNotificationSettings;
  emailSettings?: PublicEmailSettings;
  pricingSettings?: PublicPricingSettings;
  rewardsSettings?: PublicRewardsSettings;
}) {
  const [draft, setDraft] = useState<AdminSettingsDraft>({
    brandName,
    primaryColor,
    lowFilamentThresholdGrams,
    stripe: {
      ...stripeSettings,
      secretKey: maskStripeSecret(stripeSettings.secretKey),
      webhookSecret: maskStripeSecret(stripeSettings.webhookSecret)
    },
    shippo: {
      ...shippoSettings,
      apiToken: maskShippoSecret(shippoSettings.apiToken),
      originAddress: shippoSettings.originAddress ?? {
        name: "",
        street1: "",
        street2: "",
        city: "Fort Collins",
        state: "CO",
        zip: "",
        country: "US",
        phone: "",
        email: ""
      }
    },
    notifications: notificationSettings,
    email: emailSettings,
    pricing: pricingSettings,
    rewards: rewardsSettings
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
    const email = {
      ...draft.email,
      headerHtml: buildEmailHeaderHtml("{{brandName}}", "{{headerImageUrl}}", "{{footerNote}}"),
      footerHtml: buildEmailFooterHtml("{{brandName}}", "{{supportEmail}}", "{{footerNote}}"),
      templates: draft.email.templates.map((template) => ({
        ...template,
        html: buildTemplateHtml(template.id, template.text)
      }))
    };
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, email })
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Settings saved" : result.error ?? "Settings blocked");
  }

  return (
    <div className="grid gap-5 rounded-lg border bg-card p-5 text-card-foreground shadow-sm md:grid-cols-2">
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="stripe-terminal-location">Terminal location ID</Label>
          <Input
            id="stripe-terminal-location"
            value={draft.stripe.terminalLocationId}
            placeholder="tml_..."
            onChange={(event) => setDraft((current) => ({ ...current, stripe: { ...current.stripe, terminalLocationId: event.target.value } }))}
          />
        </div>
      </div>

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-3">
        <div className="md:col-span-3">
          <h3 className="font-semibold">Shippo shipping</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Used to quote checkout shipping, buy labels after payment, and print labels when orders are ready to pack.
          </p>
        </div>

        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="shippo-api-token">API token</Label>
          <Input
            id="shippo-api-token"
            value={draft.shippo.apiToken}
            placeholder="shippo_test_..."
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, apiToken: event.target.value } }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="shippo-free-threshold">Free shipping over ($)</Label>
          <Input
            id="shippo-free-threshold"
            type="number"
            step="0.01"
            value={draft.shippo.freeShippingThresholdCents == null ? "" : draft.shippo.freeShippingThresholdCents / 100}
            onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, freeShippingThresholdCents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) } }))}
          />
        </div>

        <ShippoAddressField label="Origin name" field="name" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin street" field="street1" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin suite" field="street2" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin city" field="city" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin state" field="state" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin ZIP" field="zip" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin phone" field="phone" draft={draft} setDraft={setDraft} />
        <ShippoAddressField label="Origin email" field="email" draft={draft} setDraft={setDraft} />

        <ShippoField label="Pickup city" field="pickupCity" draft={draft} setDraft={setDraft} />
        <ShippoField label="Pickup state" field="pickupState" draft={draft} setDraft={setDraft} />
        <div className="grid gap-2">
          <Label htmlFor="shippo-label-file-type">Label format</Label>
          <select
            id="shippo-label-file-type"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.shippo.labelFileType}
            onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, labelFileType: event.target.value as PublicShippoSettings["labelFileType"] } }))}
          >
            <option value="PDF_4x6">PDF 4x6</option>
            <option value="PDF">PDF</option>
            <option value="PNG">PNG</option>
            <option value="ZPLII">ZPLII</option>
          </select>
        </div>

        <ShippoField label="Print command" field="printCommand" draft={draft} setDraft={setDraft} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.shippo.autoCreateLabelAfterPrint}
            onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, autoCreateLabelAfterPrint: event.target.checked } }))}
          />
          Buy label when print completes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.shippo.autoPrintLabelAfterPrint}
            onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, autoPrintLabelAfterPrint: event.target.checked } }))}
          />
          Print label automatically
        </label>
      </div>

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-3">
        <div className="md:col-span-3">
          <h3 className="font-semibold">Customer email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cloudflare Email Service delivery plus editable shared header, footer, and transactional templates.
          </p>
        </div>

        <EmailField label="Cloudflare account ID" field="cloudflareAccountId" draft={draft} setDraft={setDraft} />
        <EmailField label="Cloudflare API token" field="apiKey" draft={draft} setDraft={setDraft} />
        <EmailField label="Email brand name" field="brandName" draft={draft} setDraft={setDraft} />
        <EmailField label="No-reply sender" field="noreplyFrom" draft={draft} setDraft={setDraft} />
        <EmailField label="Support sender" field="supportFrom" draft={draft} setDraft={setDraft} />
        <EmailField label="Header image" field="headerImageUrl" draft={draft} setDraft={setDraft} />
        <EmailField label="Footer note" field="footerNote" draft={draft} setDraft={setDraft} />

        <div className="grid gap-3 md:col-span-3">
          {draft.email.templates.map((template, index) => (
            <details key={template.id} className="rounded-md border bg-background p-3">
              <summary className="cursor-pointer text-sm font-medium">{template.label}</summary>
              <p className="mt-2 text-xs text-muted-foreground">{template.description}</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>Subject</Label>
                    <Input
                      value={template.subject}
                      onChange={(event) => updateEmailTemplate(setDraft, index, "subject", event.target.value)}
                      aria-label={`${template.label} subject`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Body copy</Label>
                    <textarea
                      value={template.text}
                      rows={7}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => updateEmailTemplate(setDraft, index, "text", event.target.value)}
                      aria-label={`${template.label} body copy`}
                    />
                  </div>
                </div>
                <EmailPreviewFrame
                  subject={template.subject}
                  headerHtml={buildEmailHeaderHtml(draft.email.brandName, draft.email.headerImageUrl, draft.email.footerNote)}
                  footerHtml={buildEmailFooterHtml(draft.email.brandName, draft.email.supportFrom, draft.email.footerNote)}
                  bodyHtml={buildTemplateHtml(template.id, template.text)}
                />
              </div>
            </details>
          ))}
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

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-3">
        <div className="md:col-span-3">
          <h3 className="font-semibold">Pricing settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Product prices are fixed per product. Tax is configurable, and payment processing uses Stripe standard card defaults.
          </p>
        </div>
        <PricingField label="Tax estimate %" field="taxPercentEstimate" draft={draft} setDraft={setDraft} percent optional />
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm md:col-span-2">
          <span className="font-medium">Stripe processing fee</span>
          <span className="text-muted-foreground">
            Auto-filled from Stripe standard US online card pricing: {(stripeStandardPaymentProcessingPercent * 100).toFixed(1)}% + ${(stripeStandardPaymentProcessingFixedCents / 100).toFixed(2)} per successful card transaction.
          </span>
        </div>
      </div>

      <div className="grid gap-4 border-t pt-5 md:col-span-2 md:grid-cols-3">
        <div className="md:col-span-3">
          <h3 className="font-semibold">Rewards settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Margin-safe defaults: earn 10 points per $1, redeem 100 points for $1 off, capped to product discounts.
          </p>
        </div>
        <RewardsField label="Points earned per $1" field="pointsPerDollar" draft={draft} setDraft={setDraft} step="0.1" />
        <RewardsField label="Points per $1 discount" field="redemptionPointsPerDollar" draft={draft} setDraft={setDraft} />
        <RewardsField label="Max product discount %" field="maxDiscountPercent" draft={draft} setDraft={setDraft} percent />
        <RewardsField label="Minimum redemption points" field="minimumRedemptionPoints" draft={draft} setDraft={setDraft} />
        <RewardsField label="Reservation expiry minutes" field="reservationTtlMinutes" draft={draft} setDraft={setDraft} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.rewards.earnOnDiscountedAmount}
            onChange={(event) => setDraft((current) => ({ ...current, rewards: { ...current.rewards, earnOnDiscountedAmount: event.target.checked } }))}
          />
          Earn on discounted product amount
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.rewards.includeShippingInEarnBasis}
            onChange={(event) => setDraft((current) => ({ ...current, rewards: { ...current.rewards, includeShippingInEarnBasis: event.target.checked } }))}
          />
          Include shipping when earning points
        </label>
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

function RewardsField({
  label,
  field,
  draft,
  setDraft,
  percent = false,
  step = "1"
}: {
  label: string;
  field: NumericRewardsField;
  draft: { rewards: PublicRewardsSettings };
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
  percent?: boolean;
  step?: string;
}) {
  const value = draft.rewards[field];
  return (
    <div className="grid gap-2">
      <Label htmlFor={`rewards-${field}`}>{label}</Label>
      <Input
        id={`rewards-${field}`}
        type="number"
        step={percent ? "0.01" : step}
        value={percent ? Number(value) * 100 : Number(value)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          setDraft((current) => ({
            ...current,
            rewards: {
              ...current.rewards,
              [field]: percent ? parsed / 100 : parsed
            }
          }));
        }}
      />
    </div>
  );
}

function EmailField({
  label,
  field,
  draft,
  setDraft
}: {
  label: string;
  field: keyof Omit<PublicEmailSettings, "templates" | "headerHtml" | "footerHtml">;
  draft: { email: PublicEmailSettings };
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`email-${field}`}>{label}</Label>
      <Input
        id={`email-${field}`}
        value={String(draft.email[field] ?? "")}
        autoComplete={field === "apiKey" ? "off" : undefined}
        onChange={(event) => setDraft((current) => ({ ...current, email: { ...current.email, [field]: event.target.value } }))}
      />
    </div>
  );
}

function updateEmailTemplate(
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>,
  index: number,
  field: "subject" | "text" | "html",
  value: string
) {
  setDraft((current) => ({
    ...current,
    email: {
      ...current.email,
      templates: current.email.templates.map((template, templateIndex) => templateIndex === index ? { ...template, [field]: value } : template)
    }
  }));
}

function EmailPreviewFrame({
  subject,
  headerHtml,
  bodyHtml,
  footerHtml
}: {
  subject?: string;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-slate-100 text-slate-950">
      {subject ? <div className="border-b bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">Subject: {sampleRender(subject)}</div> : null}
      <div
        className="max-h-[34rem] overflow-auto p-3"
        dangerouslySetInnerHTML={{
          __html: `
            <div style="max-width:680px;margin:0 auto;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0f172a;box-shadow:0 10px 30px rgba(15,23,42,.14)">
              ${sampleRender(headerHtml)}
              <main style="padding:28px;line-height:1.6;font-size:16px">${sampleRender(bodyHtml)}</main>
              ${sampleRender(footerHtml)}
            </div>
          `
        }}
      />
    </div>
  );
}

function buildEmailHeaderHtml(brandName: string, imageUrl: string, footerNote: string) {
  const src = imageUrl || "/brand/email-factory-banner.png";
  return `
<div style="background:#071015;color:#ffffff;border-bottom:3px solid #00e5ff">
  <img src="${src}" alt="" width="680" style="display:block;width:100%;max-width:680px;height:auto;border:0" />
  <div style="padding:20px 28px">
    <div style="font-size:24px;font-weight:800;letter-spacing:.02em">${brandName}</div>
    <div style="margin-top:4px;color:#9fb0bd;font-size:13px">${footerNote}</div>
  </div>
</div>`.trim();
}

function buildEmailFooterHtml(brandName: string, supportEmail: string, footerNote: string) {
  return `
<div style="padding:20px 28px;background:#081016;color:#9fb0bd;font-size:13px;line-height:1.6">
  <div>Need help? Reply here or email <a href="mailto:${supportEmail}" style="color:#00e5ff">${supportEmail}</a>.</div>
  <div style="margin-top:8px">${footerNote}</div>
  <div style="margin-top:8px">${brandName} &middot; print.superk.studio</div>
</div>`.trim();
}

function buildTemplateHtml(templateId: string, text: string) {
  const title = templateTitle(templateId);
  const button = templateButton(templateId);
  const href = templateHref(templateId);
  const body = textToParagraphs(text);
  return `
<div style="font-size:32px;line-height:1;margin-bottom:14px">${templateIcon(templateId)}</div>
<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;color:#071015">${title}</h1>
${body}
${button ? `<p style="margin-top:22px"><a href="${href}" style="display:inline-block;background:#00e5ff;color:#071015;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:8px">${button}</a></p>` : ""}`.trim();
}

function textToParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 12px">${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function templateTitle(id: string) {
  const titles: Record<string, string> = {
    "password-reset": "Reset your password",
    "account-created": "Your account is ready",
    "order-confirmation": "Order received",
    "order-processing": "Your print is processing",
    "order-ready-pickup": "Ready for pickup",
    "order-shipped": "Your order shipped",
    "support-thread-started": "Support request received",
    "support-thread-notification": "New support request",
    "support-ticket-reply": "Support ticket reply"
  };
  return titles[id] ?? "SuperPrint update";
}

function templateButton(id: string) {
  const labels: Record<string, string> = {
    "password-reset": "Reset password",
    "account-created": "Open dashboard",
    "order-confirmation": "View order",
    "order-processing": "Watch live view",
    "order-ready-pickup": "View pickup details",
    "order-shipped": "Track shipment",
    "support-thread-started": "View ticket",
    "support-thread-notification": "Open ticket",
    "support-ticket-reply": "Open ticket"
  };
  return labels[id] ?? "";
}

function templateHref(id: string) {
  const hrefs: Record<string, string> = {
    "password-reset": "{{resetUrl}}",
    "account-created": "{{dashboardUrl}}",
    "order-confirmation": "{{orderUrl}}",
    "order-processing": "{{liveUrl}}",
    "order-ready-pickup": "{{orderUrl}}",
    "order-shipped": "{{trackingUrl}}",
    "support-thread-started": "{{ticketUrl}}",
    "support-thread-notification": "{{adminTicketUrl}}",
    "support-ticket-reply": "{{ticketUrl}}"
  };
  return hrefs[id] ?? "{{dashboardUrl}}";
}

function templateIcon(id: string) {
  const icons: Record<string, string> = {
    "password-reset": "&#128274;",
    "account-created": "&#10024;",
    "order-confirmation": "&#129534;",
    "order-processing": "&#9881;&#65039;",
    "order-ready-pickup": "&#128230;",
    "order-shipped": "&#128666;",
    "support-thread-started": "&#128172;",
    "support-thread-notification": "&#127911;",
    "support-ticket-reply": "&#9993;&#65039;"
  };
  return icons[id] ?? "&#9993;&#65039;";
}

function sampleRender(value: string) {
  const samples: Record<string, string> = {
    brandName: "SuperPrint",
    footerNote: "Live manufacturing. Transparent by design.",
    supportEmail: "support@print.superk.studio",
    customerName: "Keenan",
    customerEmail: "customer@example.com",
    replyAuthor: "SuperPrint Support",
    ticketNumber: "SUP-000001",
    ticketStatus: "Awaiting customer",
    ticketUrl: "https://print.superk.studio/support/tickets/SUP-000001",
    adminTicketUrl: "https://print.superk.studio/admin/support/tickets/SUP-000001",
    orderNumber: "SP-000001",
    orderSummary: "2 x Nautilus Spinner",
    orderTotal: "$16.78",
    orderUrl: "https://print.superk.studio/orders",
    invoiceUrl: "https://print.superk.studio/orders/SP-000001/invoice",
    liveUrl: "https://print.superk.studio/queue",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction",
    resetUrl: "https://print.superk.studio/reset-password/example",
    verificationUrl: "https://print.superk.studio/verify-email",
    dashboardUrl: "https://print.superk.studio/dashboard",
    supportSubject: "Order question",
    supportMessage: "I need help with my order."
  };
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => samples[key] ?? "");
}

function PricingField({
  label,
  field,
  draft,
  setDraft,
  percent = false,
  optional = false,
  step = "1"
}: {
  label: string;
  field: keyof PublicPricingSettings;
  draft: { pricing: PublicPricingSettings };
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
  percent?: boolean;
  optional?: boolean;
  step?: string;
}) {
  const value = draft.pricing[field];
  return (
    <div className="grid gap-2">
      <Label htmlFor={`pricing-${field}`}>{label}</Label>
      <Input
        id={`pricing-${field}`}
        type="number"
        step={percent ? "0.01" : step}
        value={value == null ? "" : percent ? Number(value) * 100 : Number(value)}
        onChange={(event) => {
          const parsed = event.target.value === "" && optional ? null : Number(event.target.value);
          setDraft((current) => ({
            ...current,
            pricing: {
              ...current.pricing,
              [field]: percent && typeof parsed === "number" ? parsed / 100 : parsed
            }
          }));
        }}
      />
    </div>
  );
}

function ShippoField({
  label,
  field,
  draft,
  setDraft
}: {
  label: string;
  field: keyof Pick<PublicShippoSettings, "pickupCity" | "pickupState" | "printCommand">;
  draft: { shippo: PublicShippoSettings };
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`shippo-${field}`}>{label}</Label>
      <Input
        id={`shippo-${field}`}
        value={String(draft.shippo[field] ?? "")}
        onChange={(event) => setDraft((current) => ({ ...current, shippo: { ...current.shippo, [field]: event.target.value } }))}
      />
    </div>
  );
}

function ShippoAddressField({
  label,
  field,
  draft,
  setDraft
}: {
  label: string;
  field: keyof NonNullable<PublicShippoSettings["originAddress"]>;
  draft: { shippo: PublicShippoSettings };
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`shippo-origin-${field}`}>{label}</Label>
      <Input
        id={`shippo-origin-${field}`}
        value={String(draft.shippo.originAddress?.[field] ?? "")}
        onChange={(event) => setDraft((current) => ({
          ...current,
          shippo: {
            ...current.shippo,
            originAddress: {
              ...(current.shippo.originAddress ?? { name: "", street1: "", city: "", state: "", zip: "", country: "US" }),
              [field]: event.target.value
            }
          }
        }))}
      />
    </div>
  );
}
