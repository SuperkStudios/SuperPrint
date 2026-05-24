import type { MerchantApplication } from "@prisma/client";
import type Stripe from "stripe";
import { decryptSensitiveField } from "@/lib/secure-fields";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export type MerchantConnectOnboarding = {
  url: string;
  accountId: string;
  terminalLocationId: string;
};

export async function createMerchantConnectOnboardingLink(
  application: MerchantApplication,
  baseUrl: string,
  options: { taxId?: string | null } = {}
): Promise<MerchantConnectOnboarding> {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const taxId = normalizedTaxId(options.taxId ?? decryptSensitiveField(application.encryptedTaxId));
  const prefill = stripeAccountPrefill(application, taxId);
  const accountId = application.stripeAccountId ?? (await stripe.accounts.create(prefill)).id;
  if (application.stripeAccountId) {
    try {
      await stripe.accounts.update(application.stripeAccountId, stripeAccountUpdatePrefill(application, taxId));
    } catch (error) {
      console.warn("Could not update existing Stripe Connect account prefill.", error);
    }
  }

  const terminalLocationId = application.stripeTerminalLocationId ?? (await stripe.terminal.locations.create({
    display_name: displayBusinessName(application),
    address: stripeAddress(application)
  }, { stripeAccount: accountId })).id;
  if (application.stripeTerminalLocationId) {
    await stripe.terminal.locations.update(application.stripeTerminalLocationId, {
      display_name: displayBusinessName(application),
      address: stripeAddress(application)
    }, { stripeAccount: accountId });
  }

  await prisma.merchantApplication.update({
    where: { id: application.id },
    data: {
      stripeAccountId: accountId,
      stripeTerminalLocationId: terminalLocationId,
      stripeConnectStatus: "ACCOUNT_CREATED"
    }
  });

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${stripeRedirectBaseUrl(baseUrl)}/api/merchant/connect/refresh?application=${application.id}`,
    return_url: `${stripeRedirectBaseUrl(baseUrl)}/api/merchant/connect/return?application=${application.id}`,
    type: "account_onboarding",
    collect: "eventually_due"
  });

  await prisma.merchantApplication.update({
    where: { id: application.id },
    data: {
      stripeAccountId: accountId,
      stripeTerminalLocationId: terminalLocationId,
      stripeConnectStatus: "ONBOARDING_STARTED"
    }
  });

  return { url: accountLink.url, accountId, terminalLocationId };
}

export function requestBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function stripeRedirectBaseUrl(baseUrl: string) {
  return baseUrl.startsWith("https://") ? baseUrl : getStripeBaseUrl();
}

function stripeAccountPrefill(application: MerchantApplication, taxId?: string | null): Stripe.AccountCreateParams {
  const businessType = stripeBusinessType(application.businessType);
  return {
    type: "express",
    country: application.country || "US",
    email: application.ownerEmail,
    business_type: businessType,
    business_profile: businessProfile(application),
    ...(businessType === "individual"
      ? { individual: individualProfile(application, application.taxIdType === "SSN" ? taxId : null) }
      : { company: companyProfile(application, application.taxIdType === "EIN" ? taxId : null) }),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    metadata: {
      superprintMerchantApplicationId: application.id,
      superprintMerchantUserId: application.userId
    }
  };
}

function stripeAccountUpdatePrefill(application: MerchantApplication, taxId?: string | null): Stripe.AccountUpdateParams {
  const businessType = stripeBusinessType(application.businessType);
  return {
    email: application.ownerEmail,
    business_profile: businessProfile(application),
    ...(businessType === "individual"
      ? { individual: individualProfile(application, application.taxIdType === "SSN" ? taxId : null) }
      : { company: companyProfile(application, application.taxIdType === "EIN" ? taxId : null) }),
    metadata: {
      superprintMerchantApplicationId: application.id,
      superprintMerchantUserId: application.userId
    }
  };
}

function businessProfile(application: MerchantApplication): Stripe.AccountCreateParams.BusinessProfile {
  const address = stripeAddress(application);
  return {
    name: displayBusinessName(application),
    url: application.siteUrl,
    support_email: application.ownerEmail,
    support_phone: application.phone,
    support_url: application.siteUrl,
    support_address: address
  };
}

function companyProfile(application: MerchantApplication, taxId?: string | null): Stripe.AccountCreateParams.Company {
  return {
    name: legalBusinessName(application),
    phone: application.phone,
    tax_id: taxId || undefined,
    address: stripeAddress(application)
  };
}

function individualProfile(application: MerchantApplication, taxId?: string | null): Stripe.AccountCreateParams.Individual {
  const { firstName, lastName } = ownerNameParts(application.ownerName);
  return {
    first_name: firstName,
    last_name: lastName,
    email: application.ownerEmail,
    phone: application.phone,
    id_number: taxId || undefined,
    address: stripeAddress(application)
  };
}

function stripeAddress(application: MerchantApplication) {
  return {
    line1: application.street1,
    line2: application.street2 ?? undefined,
    city: application.city,
    state: application.state,
    postal_code: application.zip,
    country: application.country || "US"
  };
}

function displayBusinessName(application: MerchantApplication) {
  return application.businessName || application.legalBusinessName || "SuperPrint Merchant";
}

function legalBusinessName(application: MerchantApplication) {
  return application.legalBusinessName || application.businessName || "SuperPrint Merchant";
}

function normalizedTaxId(value?: string | null) {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length >= 4 ? digits : undefined;
}

function ownerNameParts(ownerName: string) {
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "Merchant", lastName: "Owner" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function stripeBusinessType(value: string) {
  if (value === "SOLE_PROPRIETORSHIP") return "individual" as const;
  if (value === "NONPROFIT") return "non_profit" as const;
  return "company" as const;
}
