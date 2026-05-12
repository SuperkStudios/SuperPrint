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
        images: [input.imageUrl]
      },
      unit_amount: input.priceCents
    },
    quantity: 1
  };
}

export function nextQueuePosition(activeQueuedPositions: Array<number | null>) {
  const positions = activeQueuedPositions.filter((position): position is number => typeof position === "number");
  return positions.length ? Math.max(...positions) + 1 : 1;
}
