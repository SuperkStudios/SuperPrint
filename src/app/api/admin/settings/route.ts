import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePrimaryColor } from "@/domain/theme";
import { buildStripeSettingsUpdate, stripeSettingKeys } from "@/domain/stripe-settings";
import { buildNotificationSettingsUpdate, notificationSettingKeys } from "@/domain/notification-settings";
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
  notifications: z.object({
    email: z.string().optional(),
    sms: z.string().optional(),
    webhookUrl: z.string().optional()
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
  if (body.notifications) {
    const notificationUpdates = buildNotificationSettingsUpdate(body.notifications);
    for (const [key, value] of Object.entries(notificationUpdates)) {
      updates.push(upsertSetting(key, value));
    }
  }
  if (body.pricing) {
    updates.push(updatePricingSettings(body.pricing));
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true, primaryColor: normalizePrimaryColor(body.primaryColor) });
}

function upsertSetting(key: string, value: string | number) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
