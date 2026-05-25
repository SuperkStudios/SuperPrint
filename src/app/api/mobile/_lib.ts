import { createMediaToken } from "@/lib/media-token";

export function serializeCustomerOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
  totalCents: number;
  subtotalCents?: number | null;
  taxCents?: number | null;
  shippingAmountCents?: number | null;
  paymentFeeCents?: number | null;
  rewardPointsEarned?: number | null;
  rewardPointsRedeemed?: number | null;
  rewardDiscountCents?: number | null;
  fulfillmentMethod?: string | null;
  shippingStatus?: string | null;
  shippingProvider?: string | null;
  shippingService?: string | null;
  trackingUrl?: string | null;
  trackingNumber?: string | null;
  createdAt: Date;
  product?: { id: string; slug: string; name: string; imageUrl: string } | null;
  upload?: { id: string; fileName: string; status: string; estimatedPriceCents?: number | null } | null;
  items?: Array<{
    id: string;
    quantity: number;
    selectedMaterial?: string | null;
    selectedColor?: string | null;
    selectedColors?: unknown;
    product: { id: string; slug: string; name: string; imageUrl: string };
  }>;
  printJobs?: Array<{
    id: string;
    status: string;
    queuePosition?: number | null;
    etaMinutes?: number | null;
    consumedFilamentGrams?: number | null;
    streamUrl?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    printer?: { publicName?: string | null; status?: string | null } | null;
  }>;
  videos?: Array<{ id: string; storageKey: string; timelapseStorageKey?: string | null }>;
}) {
  const items = order.items?.length
    ? order.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        selectedMaterial: item.selectedMaterial,
        selectedColor: item.selectedColor,
        selectedColors: stringArray(item.selectedColors)
      }))
    : order.product
      ? [{
          id: order.product.id,
          productId: order.product.id,
          name: order.product.name,
          slug: order.product.slug,
          imageUrl: order.product.imageUrl,
          quantity: 1,
          selectedMaterial: null,
          selectedColor: null,
          selectedColors: []
        }]
      : [];
  const printJobs = (order.printJobs ?? []).map((job) => ({
    id: job.id,
    status: job.status,
    queuePosition: job.queuePosition,
    etaMinutes: job.etaMinutes,
    consumedFilamentGrams: job.consumedFilamentGrams,
    streamUrl: job.streamUrl,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    printerName: job.printer?.publicName ?? null,
    printerStatus: job.printer?.status ?? null
  }));
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents ?? 0,
    taxCents: order.taxCents ?? 0,
    shippingAmountCents: order.shippingAmountCents ?? 0,
    paymentFeeCents: order.paymentFeeCents ?? 0,
    rewardPointsEarned: order.rewardPointsEarned ?? 0,
    rewardPointsRedeemed: order.rewardPointsRedeemed ?? 0,
    rewardDiscountCents: order.rewardDiscountCents ?? 0,
    fulfillmentMethod: order.fulfillmentMethod,
    shippingStatus: order.shippingStatus,
    shippingProvider: order.shippingProvider,
    shippingService: order.shippingService,
    trackingUrl: order.trackingUrl,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt.toISOString(),
    itemSummary: items.length ? items.map((item) => `${item.quantity} x ${item.name}`).join(", ") : order.upload?.fileName ?? "Custom print",
    items,
    upload: order.upload ? {
      id: order.upload.id,
      fileName: order.upload.fileName,
      status: order.upload.status,
      estimatedPriceCents: order.upload.estimatedPriceCents ?? null
    } : null,
    printJobs,
    media: (order.videos ?? []).map((video) => {
      const storageKey = video.timelapseStorageKey ?? video.storageKey;
      return {
        id: video.id,
        url: `/api/media/${createMediaToken({ key: storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`,
        type: video.timelapseStorageKey ? "timelapse" : "video"
      };
    })
  };
}

export function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  username?: string | null;
  bio?: string | null;
  rewardsPointsBalance?: number | null;
  shippingName?: string | null;
  shippingStreet1?: string | null;
  shippingStreet2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  shippingPhone?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    username: user.username,
    bio: user.bio,
    rewardsPointsBalance: user.rewardsPointsBalance ?? 0,
    shippingAddress: {
      name: user.shippingName ?? user.name,
      street1: user.shippingStreet1 ?? "",
      street2: user.shippingStreet2 ?? "",
      city: user.shippingCity ?? "",
      state: user.shippingState ?? "CO",
      zip: user.shippingZip ?? "",
      country: user.shippingCountry ?? "US",
      phone: user.shippingPhone ?? "",
      email: user.email
    }
  };
}

export function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}
