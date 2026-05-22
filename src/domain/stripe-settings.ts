export type StripeMode = "test" | "live";

export type StripeSettingsValues = Record<string, unknown>;

export type ResolvedStripeSettings = {
  mode: StripeMode;
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
  terminalLocationId: string | null;
  configured: boolean;
  source: "admin" | "env" | "none";
};

export type StripeSettingsInput = {
  mode?: StripeMode;
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  terminalLocationId?: string;
};

const secretMaskPrefixLength = 7;
const secretMask = "••••••••";

export function resolveStripeSettings(input: {
  settings?: StripeSettingsValues;
  env?: Partial<Record<string, string | undefined>>;
} = {}): ResolvedStripeSettings {
  const settings = input.settings ?? {};
  const env = input.env ?? process.env;
  const adminSecretKey = settingString(settings["stripe.secretKey"]);
  const adminPublishableKey = settingString(settings["stripe.publishableKey"]);
  const adminWebhookSecret = settingString(settings["stripe.webhookSecret"]);
  const adminTerminalLocationId = settingString(settings["stripe.terminalLocationId"]);
  const adminMode = normalizeStripeMode(settingString(settings["stripe.mode"]));

  const hasAdminConfig = Boolean(adminSecretKey || adminPublishableKey || adminWebhookSecret || adminTerminalLocationId || adminMode);
  const secretKey = adminSecretKey ?? env.STRIPE_SECRET_KEY ?? null;
  const publishableKey = adminPublishableKey ?? env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? env.STRIPE_PUBLISHABLE_KEY ?? null;
  const webhookSecret = adminWebhookSecret ?? env.STRIPE_WEBHOOK_SECRET ?? null;
  const terminalLocationId = adminTerminalLocationId ?? env.STRIPE_TERMINAL_LOCATION_ID ?? null;
  const mode = adminMode ?? inferStripeMode(secretKey ?? publishableKey) ?? "test";

  return {
    mode,
    secretKey,
    publishableKey,
    webhookSecret,
    terminalLocationId,
    configured: Boolean(secretKey),
    source: hasAdminConfig ? "admin" : secretKey || publishableKey || webhookSecret || terminalLocationId ? "env" : "none"
  };
}

export function validateStripeSettingsInput(input: StripeSettingsInput) {
  if (input.secretKey && !isMaskedStripeSecret(input.secretKey) && !/^sk_(test|live)_/.test(input.secretKey)) {
    throw new Error("Stripe secret key must start with sk_test_ or sk_live_");
  }
  if (input.publishableKey && !/^pk_(test|live)_/.test(input.publishableKey)) {
    throw new Error("Stripe publishable key must start with pk_test_ or pk_live_");
  }
  if (input.webhookSecret && !isMaskedStripeSecret(input.webhookSecret) && !/^whsec_/.test(input.webhookSecret)) {
    throw new Error("Stripe webhook secret must start with whsec_");
  }
  if (input.terminalLocationId && !/^tml_/.test(input.terminalLocationId)) {
    throw new Error("Stripe Terminal location ID must start with tml_");
  }
  if (input.mode && !["test", "live"].includes(input.mode)) {
    throw new Error("Stripe mode must be test or live");
  }
  return input;
}

export function buildStripeSettingsUpdate(input: StripeSettingsInput, existing: StripeSettingsValues = {}) {
  validateStripeSettingsInput(input);
  const updates: Record<string, string> = {};
  if (input.mode) updates["stripe.mode"] = input.mode;
  addSecretUpdate(updates, "stripe.secretKey", input.secretKey, existing);
  addPlainUpdate(updates, "stripe.publishableKey", input.publishableKey);
  addPlainUpdate(updates, "stripe.terminalLocationId", input.terminalLocationId);
  addSecretUpdate(updates, "stripe.webhookSecret", input.webhookSecret, existing);
  return updates;
}

export function maskStripeSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= secretMaskPrefixLength + 4) return `${value.slice(0, secretMaskPrefixLength)}${secretMask}`;
  return `${value.slice(0, secretMaskPrefixLength)}${secretMask}${value.slice(-4)}`;
}

export function publicStripeSettings(settings: ResolvedStripeSettings) {
  return {
    mode: settings.mode,
    configured: settings.configured,
    source: settings.source,
    secretKey: maskStripeSecret(settings.secretKey),
    publishableKey: settings.publishableKey ?? "",
    terminalLocationId: settings.terminalLocationId ?? "",
    webhookSecret: maskStripeSecret(settings.webhookSecret)
  };
}

export function stripeSettingKeys() {
  return ["stripe.secretKey", "stripe.publishableKey", "stripe.webhookSecret", "stripe.mode", "stripe.terminalLocationId"];
}

function addPlainUpdate(updates: Record<string, string>, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) updates[key] = trimmed;
}

function addSecretUpdate(updates: Record<string, string>, key: string, value: string | undefined, existing: StripeSettingsValues) {
  const trimmed = value?.trim();
  if (!trimmed || isMaskedStripeSecret(trimmed)) return;
  if (trimmed === existing[key]) return;
  updates[key] = trimmed;
}

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStripeMode(value: string | null): StripeMode | null {
  return value === "live" || value === "test" ? value : null;
}

function inferStripeMode(value: string | null): StripeMode | null {
  if (!value) return null;
  if (value.startsWith("sk_live_") || value.startsWith("pk_live_")) return "live";
  if (value.startsWith("sk_test_") || value.startsWith("pk_test_")) return "test";
  return null;
}

function isMaskedStripeSecret(value: string) {
  return value.includes(secretMask) || value.includes("****");
}
