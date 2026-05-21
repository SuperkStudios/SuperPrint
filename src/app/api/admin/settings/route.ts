import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePrimaryColor } from "@/domain/theme";
import { buildStripeSettingsUpdate, stripeSettingKeys } from "@/domain/stripe-settings";
import { buildShippoSettingsUpdate, shippoSettingKeys } from "@/domain/shippo-settings";
import { buildNotificationSettingsUpdate, notificationSettingKeys } from "@/domain/notification-settings";
import { buildEmailSettingsUpdate, defaultEmailTemplates, emailSettingKeys } from "@/domain/email-templates";
import { buildRewardsSettingsUpdate } from "@/domain/rewards";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updatePricingSettings } from "@/services/pricing";

const settingsSchema = z.object({
  brandName: z.string().min(1).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lowFilamentThresholdGrams: z.number().int().nonnegative().optional(),
  stripe: z.object({
    mode: z.enum(["test", "live"]).optional(),
    secretKey: z.string().optional(),
    publishableKey: z.string().optional(),
    webhookSecret: z.string().optional()
  }).optional(),
  shippo: z.object({
    apiToken: z.string().optional(),
    freeShippingThresholdCents: z.number().int().nonnegative().nullable().optional(),
    pickupCity: z.string().optional(),
    pickupState: z.string().optional(),
    autoCreateLabelAfterPrint: z.boolean().optional(),
    autoPrintLabelAfterPrint: z.boolean().optional(),
    printCommand: z.string().optional(),
    labelFileType: z.enum(["PDF", "PNG", "PDF_4x6", "ZPLII"]).optional(),
    originAddress: z.object({
      name: z.string().optional(),
      street1: z.string().optional(),
      street2: z.string().optional().nullable(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable()
    }).optional().nullable()
  }).optional(),
  notifications: z.object({
    email: z.string().optional(),
    sms: z.string().optional(),
    webhookUrl: z.string().optional()
  }).optional(),
  email: z.object({
    apiUrl: z.string().optional(),
    apiKey: z.string().optional(),
    noreplyFrom: z.string().email().optional(),
    supportFrom: z.string().email().optional(),
    brandName: z.string().optional(),
    headerImageUrl: z.string().optional(),
    footerNote: z.string().optional(),
    headerHtml: z.string().optional(),
    footerHtml: z.string().optional(),
    templates: z.array(z.object({
      id: z.enum(defaultEmailTemplates.map((template) => template.id) as [typeof defaultEmailTemplates[number]["id"], ...Array<typeof defaultEmailTemplates[number]["id"]>]),
      subject: z.string().optional(),
      text: z.string().optional(),
      html: z.string().optional()
    })).optional()
  }).optional(),
  pricing: z.object({
    machineHourlyRateCents: z.number().int().nonnegative().optional(),
    laborHourlyRateCents: z.number().int().nonnegative().optional(),
    electricityHourlyRateCents: z.number().int().nonnegative().optional(),
    maintenanceReservePercent: z.number().nonnegative().optional(),
    failureReservePercent: z.number().nonnegative().optional(),
    defaultProfitMultiplier: z.number().positive().optional(),
    paymentProcessingPercent: z.number().nonnegative().optional(),
    paymentProcessingFixedCents: z.number().int().nonnegative().optional(),
    taxPercentEstimate: z.number().nonnegative().nullable().optional(),
    minimumOrderPriceCents: z.number().int().nonnegative().optional()
  }).optional(),
  rewards: z.object({
    pointsPerDollar: z.number().nonnegative().optional(),
    redemptionPointsPerDollar: z.number().positive().optional(),
    maxDiscountPercent: z.number().nonnegative().optional(),
    minimumRedemptionPoints: z.number().int().nonnegative().optional(),
    earnOnDiscountedAmount: z.boolean().optional(),
    includeShippingInEarnBasis: z.boolean().optional(),
    reservationTtlMinutes: z.number().positive().optional()
  }).optional()
});

export async function POST(request: Request) {
  const { response } = await requireAdmin("settings");
  if (response) return response;

  const body = settingsSchema.parse(await request.json());
  const updates: Promise<unknown>[] = [
    upsertSetting("company.primaryColor", normalizePrimaryColor(body.primaryColor))
  ];

  if (body.brandName) {
    updates.push(upsertSetting("company.brandName", body.brandName));
  }
  if (typeof body.lowFilamentThresholdGrams === "number") {
    updates.push(upsertSetting("filament.lowThresholdGrams", body.lowFilamentThresholdGrams));
  }
  if (body.stripe) {
    const existingStripeSettings = await prisma.systemSetting.findMany({
      where: { key: { in: stripeSettingKeys() } }
    });
    const existingValues = Object.fromEntries(existingStripeSettings.map((setting) => [setting.key, setting.value]));
    const stripeUpdates = buildStripeSettingsUpdate(body.stripe, existingValues);
    for (const [key, value] of Object.entries(stripeUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }
  if (body.shippo) {
    const existingShippoSettings = await prisma.systemSetting.findMany({
      where: { key: { in: shippoSettingKeys() } }
    });
    const existingValues = Object.fromEntries(existingShippoSettings.map((setting) => [setting.key, setting.value]));
    const shippoUpdates = buildShippoSettingsUpdate(body.shippo, existingValues);
    for (const [key, value] of Object.entries(shippoUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }
  if (body.notifications) {
    const notificationUpdates = buildNotificationSettingsUpdate(body.notifications);
    for (const [key, value] of Object.entries(notificationUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }
  if (body.email) {
    const existingEmailSettings = await prisma.systemSetting.findMany({
      where: { key: { in: emailSettingKeys() } }
    });
    const existingValues = Object.fromEntries(existingEmailSettings.map((setting) => [setting.key, setting.value]));
    const emailUpdates = buildEmailSettingsUpdate(body.email, existingValues);
    for (const [key, value] of Object.entries(emailUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }
  if (body.pricing) {
    updates.push(updatePricingSettings(body.pricing));
  }
  if (body.rewards) {
    const rewardUpdates = buildRewardsSettingsUpdate(body.rewards);
    for (const [key, value] of Object.entries(rewardUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true, primaryColor: normalizePrimaryColor(body.primaryColor) });
}

function upsertSetting(key: string, value: string | number | boolean) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
