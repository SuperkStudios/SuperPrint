import { tmpdir } from "node:os";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product } from "@prisma/client";
import { isPickupAddressEligible, type ResolvedShippoSettings, type ShippingAddress } from "@/domain/shippo-settings";
import { prisma } from "@/lib/prisma";
import { getShippoSettings, shippoRequest } from "@/lib/shippo";
import { printShippingLabelFile } from "@/services/label-printer";

type ShippoRate = {
  object_id: string;
  amount: string;
  currency: string;
  provider?: string;
  servicelevel?: { name?: string; token?: string };
  servicelevel_name?: string;
  estimated_days?: number | null;
  duration_terms?: string | null;
};

type ShippoShipmentResponse = {
  object_id: string;
  status?: string;
  rates?: ShippoRate[];
  messages?: Array<{ text?: string; message?: string }>;
};

type ShippoTransactionResponse = {
  object_id: string;
  status: string;
  rate?: string | ShippoRate;
  tracking_number?: string;
  tracking_url_provider?: string;
  label_url?: string;
  messages?: Array<{ text?: string; message?: string }>;
};

export type FulfillmentMethod = "SHIP" | "PICKUP";

export type CheckoutFulfillmentInput = {
  method: FulfillmentMethod;
  address?: Partial<ShippingAddress> | null;
};

export async function prepareCheckoutShipping(input: {
  product: Pick<Product, "name" | "estimatedGrams" | "shippingPackageLengthIn" | "shippingPackageWidthIn" | "shippingPackageHeightIn" | "shippingPackageWeightOz" | "shippingParcelTemplateId">;
  productPriceCents: number;
  quantity?: number;
  customerEmail?: string | null;
  fulfillment: CheckoutFulfillmentInput;
}) {
  const settings = await getShippoSettings();
  if (input.fulfillment.method === "PICKUP") {
    const address = normalizePickupAddress(input.fulfillment.address, input.customerEmail);
    if (!address || !isPickupAddressEligible(address, settings)) {
      throw new Error(`Pickup is only available in ${settings.pickupCity}, ${settings.pickupState}.`);
    }
    return {
      method: "PICKUP" as const,
      shippingAmountCents: 0,
      shippingRateCents: 0,
      address,
      rate: null,
      shippoShipmentId: null
    };
  }

  const address = normalizeShippingAddress(input.fulfillment.address, input.customerEmail);
  if (!address) throw new Error("A complete shipping address is required.");
  if (!settings.configured || !settings.originAddress) {
    throw new Error("Shippo shipping is not configured yet. Add the API token and origin address in admin settings.");
  }

  const quote = await createBestRateQuote({
    settings,
    address,
    product: input.product,
    quantity: input.quantity ?? 1,
    metadata: `SuperPrint checkout ${input.product.name}`
  });
  const threshold = settings.freeShippingThresholdCents;
  const shippingAmountCents = threshold != null && input.productPriceCents >= threshold ? 0 : quote.rateCents;
  return {
    method: "SHIP" as const,
    shippingAmountCents,
    shippingRateCents: quote.rateCents,
    address,
    rate: quote.rate,
    shippoShipmentId: quote.shipmentId
  };
}

export async function buyLabelForOrder(orderId: string, options: { print?: boolean } = {}) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true, customer: true } });
  if (order.fulfillmentMethod !== "SHIP") throw new Error("Pickup orders do not need a shipping label.");
  if (order.paymentStatus !== "PAID") throw new Error("Shipping labels can only be purchased after payment is confirmed.");
  if (order.status !== "COMPLETED") throw new Error("Shipping labels can only be purchased after the print is completed.");
  if (order.shippingLabelUrl && order.shippoTransactionId) {
    if (!order.trackingUrl || !order.trackingNumber) {
      await refreshOrderTrackingFromShippo(order.id, order.shippoTransactionId);
    }
    if (options.print) await printOrderLabel(order.id);
    return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { product: true, customer: true } });
  }
  if (!order.shippoRateId) throw new Error("This order does not have a Shippo rate. Recreate the checkout or add shipping details.");

  const settings = await getShippoSettings();
  const transaction = await shippoRequest<ShippoTransactionResponse>("/transactions/", {
    method: "POST",
    body: JSON.stringify({
      rate: order.shippoRateId,
      label_file_type: settings.labelFileType,
      async: false,
      metadata: order.orderNumber
    })
  });
  if (transaction.status !== "SUCCESS" || !transaction.label_url) {
    const message = transaction.messages?.map((item) => item.text ?? item.message).filter(Boolean).join("; ");
    throw new Error(message || "Shippo did not return a purchased label.");
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      shippoTransactionId: transaction.object_id,
      shippingLabelUrl: transaction.label_url,
      trackingNumber: transaction.tracking_number,
      trackingUrl: transaction.tracking_url_provider,
      shippingStatus: "LABEL_READY"
    }
  });
  if (options.print) await printOrderLabel(updated.id);
  return updated;
}

export async function markOrderShippedWithShippoTracking(orderId: string) {
  let order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.fulfillmentMethod === "SHIP") {
    if (!order.shippoTransactionId || !order.shippingLabelUrl || !order.trackingUrl) {
      order = await buyLabelForOrder(orderId);
    } else if (!order.trackingUrl || !order.trackingNumber) {
      order = await refreshOrderTrackingFromShippo(order.id, order.shippoTransactionId);
    }
    if (!order.trackingUrl) {
      throw new Error("Shippo did not return a carrier tracking link for this label yet.");
    }
  }
  return prisma.order.update({
    where: { id: order.id },
    data: { shippingStatus: "SHIPPED" }
  });
}

export async function maybeCreateLabelAfterPrint(orderId: string) {
  const settings = await getShippoSettings();
  if (!settings.autoCreateLabelAfterPrint) return null;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { fulfillmentMethod: true } });
  if (order?.fulfillmentMethod !== "SHIP") return null;
  return buyLabelForOrder(orderId, { print: settings.autoPrintLabelAfterPrint }).catch((error) => {
    console.error("Could not create Shippo label after print completion", error);
    return null;
  });
}

export async function printOrderLabel(orderId: string) {
  const [order, settings] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
    getShippoSettings()
  ]);
  if (!order.shippingLabelUrl) throw new Error("No shipping label is available for this order.");
  const response = await fetch(order.shippingLabelUrl);
  if (!response.ok) throw new Error(`Could not download label (${response.status}).`);
  const extension = labelExtension(order.shippingLabelUrl);
  const filePath = path.join(tmpdir(), `${order.orderNumber}-shipping-label.${extension}`);
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  await printShippingLabelFile(filePath, settings);
  return prisma.order.update({
    where: { id: order.id },
    data: { labelPrintedAt: new Date(), shippingStatus: "LABEL_PRINTED" }
  });
}

async function refreshOrderTrackingFromShippo(orderId: string, transactionId: string) {
  const transaction = await shippoRequest<ShippoTransactionResponse>(`/transactions/${transactionId}/`);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: transaction.tracking_number,
      trackingUrl: transaction.tracking_url_provider
    }
  });
}

async function createBestRateQuote(input: {
  settings: ResolvedShippoSettings;
  address: ShippingAddress;
  product: Pick<Product, "estimatedGrams" | "shippingPackageLengthIn" | "shippingPackageWidthIn" | "shippingPackageHeightIn" | "shippingPackageWeightOz" | "shippingParcelTemplateId">;
  quantity: number;
  metadata: string;
}) {
  const shipment = await shippoRequest<ShippoShipmentResponse>("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: shippoAddress(input.settings.originAddress!),
      address_to: shippoAddress(input.address),
      parcels: [buildProductParcel(input.product, input.quantity)],
      metadata: input.metadata,
      async: false
    })
  });
  const rates = (shipment.rates ?? []).filter((rate) => rate.currency === "USD" && Number.isFinite(Number(rate.amount)));
  if (!rates.length) {
    const message = shipment.messages?.map((item) => item.text ?? item.message).filter(Boolean).join("; ");
    throw new Error(message || "Shippo did not return any shipping rates for this address.");
  }
  const rate = rates.sort((a, b) => Number(a.amount) - Number(b.amount))[0];
  return {
    shipmentId: shipment.object_id,
    rate,
    rateCents: Math.round(Number(rate.amount) * 100)
  };
}

function normalizePickupAddress(address: Partial<ShippingAddress> | null | undefined, fallbackEmail?: string | null): ShippingAddress | null {
  const normalized = {
    name: address?.name?.trim(),
    street1: address?.street1?.trim() || "Local pickup",
    street2: address?.street2?.trim() || null,
    city: address?.city?.trim(),
    state: address?.state?.trim().toUpperCase(),
    zip: address?.zip?.trim() || "80521",
    country: address?.country?.trim().toUpperCase() || "US",
    phone: address?.phone?.trim() || null,
    email: address?.email?.trim() || fallbackEmail || null
  };
  if (!normalized.name || !normalized.city || !normalized.state) return null;
  return normalized as ShippingAddress;
}

function normalizeShippingAddress(address: Partial<ShippingAddress> | null | undefined, fallbackEmail?: string | null): ShippingAddress | null {
  const normalized = {
    name: address?.name?.trim(),
    street1: address?.street1?.trim(),
    street2: address?.street2?.trim() || null,
    city: address?.city?.trim(),
    state: address?.state?.trim().toUpperCase(),
    zip: address?.zip?.trim(),
    country: address?.country?.trim().toUpperCase() || "US",
    phone: address?.phone?.trim() || null,
    email: address?.email?.trim() || fallbackEmail || null
  };
  if (!normalized.name || !normalized.street1 || !normalized.city || !normalized.state || !normalized.zip) return null;
  return normalized as ShippingAddress;
}

function shippoAddress(address: ShippingAddress) {
  return {
    name: address.name,
    street1: address.street1,
    street2: address.street2 ?? "",
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country,
    phone: address.phone ?? "",
    email: address.email ?? ""
  };
}

function buildProductParcel(product: Pick<Product, "estimatedGrams" | "shippingPackageLengthIn" | "shippingPackageWidthIn" | "shippingPackageHeightIn" | "shippingPackageWeightOz" | "shippingParcelTemplateId">, quantity: number) {
  const safeQuantity = Math.max(1, Math.round(quantity));
  const productWeightOz = Math.max(1, product.estimatedGrams * 0.035274);
  const packedWeightOz = Math.max(product.shippingPackageWeightOz, productWeightOz);
  const parcel = {
    length: String(product.shippingPackageLengthIn),
    width: String(product.shippingPackageWidthIn),
    height: String(product.shippingPackageHeightIn * safeQuantity),
    distance_unit: "in",
    weight: String(Math.ceil(packedWeightOz * safeQuantity)),
    mass_unit: "oz"
  };
  if (!product.shippingParcelTemplateId) return parcel;
  return {
    ...parcel,
    template: product.shippingParcelTemplateId
  };
}

function labelExtension(url: string) {
  if (/\.png(\?|$)/i.test(url)) return "png";
  if (/\.zpl(\?|$)|ZPL/i.test(url)) return "zpl";
  return "pdf";
}
