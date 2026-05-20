export type ShippoSettingsValues = Record<string, unknown>;

export const defaultShippoPrintCommand = "superprint-ble-a42bt";

export type ShippingAddress = {
  name: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
  email?: string | null;
};

export type ResolvedShippoSettings = {
  apiToken: string | null;
  configured: boolean;
  source: "admin" | "env" | "none";
  freeShippingThresholdCents: number | null;
  pickupCity: string;
  pickupState: string;
  autoCreateLabelAfterPrint: boolean;
  autoPrintLabelAfterPrint: boolean;
  printCommand: string;
  labelFileType: "PDF" | "PNG" | "PDF_4x6" | "ZPLII";
  originAddress: ShippingAddress | null;
};

export type ShippoSettingsInput = {
  apiToken?: string;
  freeShippingThresholdCents?: number | null;
  pickupCity?: string;
  pickupState?: string;
  autoCreateLabelAfterPrint?: boolean;
  autoPrintLabelAfterPrint?: boolean;
  printCommand?: string;
  labelFileType?: ResolvedShippoSettings["labelFileType"];
  originAddress?: Partial<ShippingAddress> | null;
};

const secretMaskPrefixLength = 8;
const secretMask = "••••••••";
const labelFileTypes = ["PDF", "PNG", "PDF_4x6", "ZPLII"] as const;

export function resolveShippoSettings(input: {
  settings?: ShippoSettingsValues;
  env?: Partial<Record<string, string | undefined>>;
} = {}): ResolvedShippoSettings {
  const settings = input.settings ?? {};
  const env = input.env ?? process.env;
  const adminToken = settingString(settings["shippo.apiToken"]);
  const envToken = env.SHIPPO_API_TOKEN ?? null;
  const apiToken = adminToken ?? envToken;
  const originAddress = buildOriginAddress(settings);

  return {
    apiToken,
    configured: Boolean(apiToken && originAddress),
    source: adminToken ? "admin" : envToken ? "env" : "none",
    freeShippingThresholdCents: settingNumber(settings["shippo.freeShippingThresholdCents"]),
    pickupCity: settingString(settings["shippo.pickupCity"]) ?? "Fort Collins",
    pickupState: settingString(settings["shippo.pickupState"]) ?? "CO",
    autoCreateLabelAfterPrint: settingBoolean(settings["shippo.autoCreateLabelAfterPrint"]) ?? false,
    autoPrintLabelAfterPrint: settingBoolean(settings["shippo.autoPrintLabelAfterPrint"]) ?? false,
    printCommand: settingString(settings["shippo.printCommand"]) ?? defaultShippoPrintCommand,
    labelFileType: normalizeLabelFileType(settingString(settings["shippo.labelFileType"])) ?? "PDF_4x6",
    originAddress
  };
}

export function buildShippoSettingsUpdate(input: ShippoSettingsInput, existing: ShippoSettingsValues = {}) {
  const updates: Record<string, string | number | boolean> = {};
  addSecretUpdate(updates, "shippo.apiToken", input.apiToken, existing);
  addOptionalNumberUpdate(updates, "shippo.freeShippingThresholdCents", input.freeShippingThresholdCents);
  addPlainUpdate(updates, "shippo.pickupCity", input.pickupCity);
  addPlainUpdate(updates, "shippo.pickupState", input.pickupState);
  addBooleanUpdate(updates, "shippo.autoCreateLabelAfterPrint", input.autoCreateLabelAfterPrint);
  addBooleanUpdate(updates, "shippo.autoPrintLabelAfterPrint", input.autoPrintLabelAfterPrint);
  addPlainUpdate(updates, "shippo.printCommand", input.printCommand);
  if (input.labelFileType && labelFileTypes.includes(input.labelFileType)) updates["shippo.labelFileType"] = input.labelFileType;

  addPlainUpdate(updates, "shippo.origin.name", input.originAddress?.name);
  addPlainUpdate(updates, "shippo.origin.street1", input.originAddress?.street1);
  addPlainUpdate(updates, "shippo.origin.street2", input.originAddress?.street2 ?? undefined);
  addPlainUpdate(updates, "shippo.origin.city", input.originAddress?.city);
  addPlainUpdate(updates, "shippo.origin.state", input.originAddress?.state);
  addPlainUpdate(updates, "shippo.origin.zip", input.originAddress?.zip);
  addPlainUpdate(updates, "shippo.origin.country", input.originAddress?.country);
  addPlainUpdate(updates, "shippo.origin.phone", input.originAddress?.phone ?? undefined);
  addPlainUpdate(updates, "shippo.origin.email", input.originAddress?.email ?? undefined);
  return updates;
}

export function publicShippoSettings(settings: ResolvedShippoSettings) {
  return {
    ...settings,
    apiToken: maskShippoSecret(settings.apiToken)
  };
}

export function shippoSettingKeys() {
  return [
    "shippo.apiToken",
    "shippo.freeShippingThresholdCents",
    "shippo.pickupCity",
    "shippo.pickupState",
    "shippo.autoCreateLabelAfterPrint",
    "shippo.autoPrintLabelAfterPrint",
    "shippo.printCommand",
    "shippo.labelFileType",
    "shippo.origin.name",
    "shippo.origin.street1",
    "shippo.origin.street2",
    "shippo.origin.city",
    "shippo.origin.state",
    "shippo.origin.zip",
    "shippo.origin.country",
    "shippo.origin.phone",
    "shippo.origin.email"
  ];
}

export function maskShippoSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= secretMaskPrefixLength + 4) return `${value.slice(0, secretMaskPrefixLength)}${secretMask}`;
  return `${value.slice(0, secretMaskPrefixLength)}${secretMask}${value.slice(-4)}`;
}

export function isPickupAddressEligible(address: Pick<ShippingAddress, "city" | "state">, settings: Pick<ResolvedShippoSettings, "pickupCity" | "pickupState">) {
  return normalize(address.city) === normalize(settings.pickupCity) && normalize(address.state) === normalize(settings.pickupState);
}

function buildOriginAddress(settings: ShippoSettingsValues): ShippingAddress | null {
  const address = {
    name: settingString(settings["shippo.origin.name"]),
    street1: settingString(settings["shippo.origin.street1"]),
    street2: settingString(settings["shippo.origin.street2"]),
    city: settingString(settings["shippo.origin.city"]),
    state: settingString(settings["shippo.origin.state"]),
    zip: settingString(settings["shippo.origin.zip"]),
    country: settingString(settings["shippo.origin.country"]) ?? "US",
    phone: settingString(settings["shippo.origin.phone"]),
    email: settingString(settings["shippo.origin.email"])
  };
  if (!address.name || !address.street1 || !address.city || !address.state || !address.zip) return null;
  return address as ShippingAddress;
}

function addPlainUpdate(updates: Record<string, string | number | boolean>, key: string, value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed) updates[key] = trimmed;
}

function addOptionalNumberUpdate(updates: Record<string, string | number | boolean>, key: string, value?: number | null) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) updates[key] = Math.round(value);
}

function addBooleanUpdate(updates: Record<string, string | number | boolean>, key: string, value?: boolean) {
  if (typeof value === "boolean") updates[key] = value;
}

function addSecretUpdate(updates: Record<string, string | number | boolean>, key: string, value: string | undefined, existing: ShippoSettingsValues) {
  const trimmed = value?.trim();
  if (!trimmed || isMaskedSecret(trimmed) || trimmed === existing[key]) return;
  updates[key] = trimmed;
}

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function settingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function settingBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeLabelFileType(value: string | null) {
  return labelFileTypes.find((item) => item === value) ?? null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isMaskedSecret(value: string) {
  return value.includes(secretMask) || value.includes("****");
}
