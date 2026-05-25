export function buildStripeProductLineItem(input: {
  name: string;
  description: string;
  imageUrl: string;
  priceCents: number;
}) {
  if (input.priceCents <= 0) {
    throw new Error("Stripe checkout requires a positive price");
  }

  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: input.name,
        description: input.description,
        ...buildStripeProductImages(input.imageUrl)
      },
      unit_amount: input.priceCents
    },
    quantity: 1
  };
}

export function buildStripeShippingLineItem(input: { amountCents: number; description?: string | null }) {
  if (input.amountCents <= 0) return null;
  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: "Shipping",
        description: input.description ?? "Best available Shippo shipping rate"
      },
      unit_amount: input.amountCents
    },
    quantity: 1
  };
}

export function buildStripeAdjustmentLineItem(input: { name: string; amountCents: number; description?: string | null }) {
  if (input.amountCents <= 0) return null;
  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: input.name,
        description: input.description ?? input.name
      },
      unit_amount: input.amountCents
    },
    quantity: 1
  };
}

function buildStripeProductImages(imageUrl: string) {
  if (!/^https?:\/\//.test(imageUrl)) return {};
  return { images: [imageUrl] };
}

export function nextQueuePosition(activeQueuedPositions: Array<number | null>) {
  const positions = activeQueuedPositions.filter((position): position is number => typeof position === "number");
  return positions.length ? Math.max(...positions) + 1 : 1;
}

export function buildStripeCheckoutSuccessUrl(baseUrl: string, orderId: string) {
  return `${baseUrl}/orders?checkout=success&order=${orderId}&session_id={CHECKOUT_SESSION_ID}`;
}

export function isPaidStripeCheckoutSession(
  session: { status?: string | null; payment_status?: string | null; metadata?: Record<string, string> | null },
  orderId: string
) {
  return session.status === "complete" && session.payment_status === "paid" && session.metadata?.orderId === orderId;
}

export function resolveCheckoutSelection(
  product: { defaultMaterial: string },
  selection: { selectedMaterial?: string | null; selectedColor?: string | null }
) {
  const selectedMaterial = normalizeMaterial(selection.selectedMaterial) ?? product.defaultMaterial;
  const selectedColor = normalizeColor(selection.selectedColor);
  return { selectedMaterial, selectedColor };
}

function normalizeMaterial(value?: string | null) {
  const material = value?.trim().toUpperCase();
  return material || undefined;
}

function normalizeColor(value?: string | null) {
  const color = value?.trim();
  if (!color) return undefined;
  return color
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
