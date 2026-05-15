import Stripe from "stripe";
import { resolveStripeSettings, stripeSettingKeys } from "@/domain/stripe-settings";
import { prisma } from "@/lib/prisma";

export async function getStripe() {
  const { secretKey: key } = await getStripeSettings();
  if (!key) return null;
  return new Stripe(key);
}

export async function getStripeSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: stripeSettingKeys() } }
  });
  return resolveStripeSettings({
    settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  });
}

export function getStripeBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
