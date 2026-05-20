"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { buildThemeCssVariables, normalizePrimaryColor } from "@/domain/theme";
import { maskStripeSecret } from "@/domain/stripe-settings";
import { defaultShippoPrintCommand, maskShippoSecret } from "@/domain/shippo-settings";
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
  machineHourlyRateCents: number;
  laborHourlyRateCents: number;
  electricityHourlyRateCents: number;
  maintenanceReservePercent: number;
  failureReservePercent: number;
  defaultProfitMultiplier: number;
  paymentProcessingPercent: number;
  paymentProcessingFixedCents: number;
  taxPercentEstimate?: number | null;
  minimumOrderPriceCents: number;
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
  pricing: PublicPricingSettings;
  rewards: PublicRewardsSettings;
};

const defaultPricingSettings: PublicPricingSettings = {
  machineHourlyRateCents: 250,
  laborHourlyRateCents: 1800,
  electricityHourlyRateCents: 20,
  maintenanceReservePercent: 0.08,
  failureReservePercent: 0.12,
  defaultProfitMultiplier: 2,
  paymentProcessingPercent: 0.029,
  paymentProcessingFixedCents: 30,
  taxPercentEstimate: null,
  minimumOrderPriceCents: 500
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
  pricingSettings = defaultPricingSettings,
  rewardsSettings = defaultRewardsSettings
}: {
  brandName: string;
  primaryColor: string;
  lowFilamentThresholdGrams: number;
  stripeSettings?: PublicStripeSettings;
  shippoSettings?: PublicShippoSettings;
  notificationSettings?: PublicNotificationSettings;
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
            Used by dynamic product pricing, admin previews, checkout, and order pricing snapshots.
          </p>
        </div>
        <PricingField label="Machine hourly rate" field="machineHourlyRateCents" draft={draft} setDraft={setDraft} />
        <PricingField label="Labor hourly rate" field="laborHourlyRateCents" draft={draft} setDraft={setDraft} />
        <PricingField label="Electricity hourly rate" field="electricityHourlyRateCents" draft={draft} setDraft={setDraft} />
        <PricingField label="Maintenance reserve %" field="maintenanceReservePercent" draft={draft} setDraft={setDraft} percent />
        <PricingField label="Failure reserve %" field="failureReservePercent" draft={draft} setDraft={setDraft} percent />
        <PricingField label="Profit multiplier" field="defaultProfitMultiplier" draft={draft} setDraft={setDraft} step="0.01" />
        <PricingField label="Payment processing %" field="paymentProcessingPercent" draft={draft} setDraft={setDraft} percent />
        <PricingField label="Fixed payment fee" field="paymentProcessingFixedCents" draft={draft} setDraft={setDraft} />
        <PricingField label="Tax estimate %" field="taxPercentEstimate" draft={draft} setDraft={setDraft} percent optional />
        <PricingField label="Minimum order price" field="minimumOrderPriceCents" draft={draft} setDraft={setDraft} />
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
