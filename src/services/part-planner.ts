import { prisma } from "@/lib/prisma";

export type PlannerRow = {
  key: string;
  productId: string;
  productName: string;
  partId: string;
  partName: string;
  color: string;
  requiredQuantity: number;
  quantityPerProductColor: number;
  quantityOnHand: number;
  quantityToPrint: number;
  suggestedPlateQuantity: number;
  suggestedPlateCount: number;
  plates: Array<{ plateIndex: number; plateCount: number; quantity: number; maxPerPlate: number; isFull: boolean }>;
  orders: Array<{ orderNumber: string; quantity: number; customerEmail: string }>;
};

export async function getPartProductionPlanner(): Promise<PlannerRow[]> {
  const [orders, inventory] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["CHECKOUT_READY", "PAID", "QUEUED", "PRINTING"] },
        orderSource: { not: "PAST_IMPORT" },
        OR: [
          { paymentStatus: { in: ["PAID", "PARTIAL"] } },
          { orderSource: { in: ["IN_PERSON", "BACKLOG_IMPORT"] } }
        ]
      },
      include: {
        customer: true,
        items: {
          include: {
            product: { include: { parts: { orderBy: { displayOrder: "asc" } } } }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.productPartInventory.findMany()
  ]);

  const inventoryByPartAndColor = new Map<string, number>();
  for (const item of inventory) {
    const key = inventoryKey(item.productPartId, item.color);
    inventoryByPartAndColor.set(key, (inventoryByPartAndColor.get(key) ?? 0) + item.quantityOnHand);
  }

  const rows = new Map<string, PlannerRow>();
  for (const order of orders) {
    for (const item of order.items) {
      const selectedColors = jsonStringArray(item.selectedColors).length ? jsonStringArray(item.selectedColors) : item.selectedColor ? [item.selectedColor] : [];
      for (const part of item.product.parts) {
        const pattern = part.colorSlotPattern.length ? part.colorSlotPattern : Array.from({ length: part.quantityPerUnit }, () => part.colorSlotIndex);
        const colorCounts = new Map<string, number>();
        for (const slotIndex of pattern) {
          const color = selectedColors[slotIndex] ?? selectedColors[0] ?? item.selectedColor ?? "Unassigned";
          colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
        }
        for (const [color, quantityPerProductColor] of colorCounts) {
          const key = `${part.id}:${color}`;
          const quantity = Math.max(0, item.quantity - item.printedQuantity) * quantityPerProductColor;
          if (!quantity) continue;
          const existing = rows.get(key);
          if (existing) {
            existing.requiredQuantity += quantity;
            existing.quantityPerProductColor = Math.max(existing.quantityPerProductColor, quantityPerProductColor);
            existing.orders.push({ orderNumber: order.orderNumber, quantity: Math.max(0, item.quantity - item.printedQuantity), customerEmail: order.customer.email });
            continue;
          }
          const quantityOnHand = inventoryByPartAndColor.get(inventoryKey(part.id, color)) ?? 0;
          rows.set(key, {
            key,
            productId: item.product.id,
            productName: item.product.name,
            partId: part.id,
            partName: part.name,
            color,
            requiredQuantity: quantity,
            quantityPerProductColor,
            quantityOnHand,
            quantityToPrint: 0,
            suggestedPlateQuantity: Math.max(1, item.product.maxBatchQuantity * Math.max(1, quantityPerProductColor)),
            suggestedPlateCount: 0,
            plates: [],
            orders: [{ orderNumber: order.orderNumber, quantity: Math.max(0, item.quantity - item.printedQuantity), customerEmail: order.customer.email }]
          });
        }
      }
    }
  }

  return [...rows.values()]
    .map((row) => {
      const quantityToPrint = Math.max(0, row.requiredQuantity - row.quantityOnHand);
      const suggestedPlateCount = quantityToPrint ? Math.ceil(quantityToPrint / row.suggestedPlateQuantity) : 0;
      return {
        ...row,
        quantityToPrint,
        suggestedPlateCount,
        plates: Array.from({ length: suggestedPlateCount }, (_, index) => {
          const quantity = Math.min(row.suggestedPlateQuantity, quantityToPrint - index * row.suggestedPlateQuantity);
          return {
            plateIndex: index + 1,
            plateCount: suggestedPlateCount,
            quantity,
            maxPerPlate: row.suggestedPlateQuantity,
            isFull: quantity >= row.suggestedPlateQuantity
          };
        })
      };
    })
    .sort((a, b) => b.quantityToPrint - a.quantityToPrint || a.productName.localeCompare(b.productName) || a.color.localeCompare(b.color));
}

export async function getPartInventoryRows() {
  return prisma.productPart.findMany({
    include: {
      product: true,
      inventory: { orderBy: [{ color: "asc" }, { location: "asc" }] }
    },
    orderBy: [{ product: { name: "asc" } }, { displayOrder: "asc" }]
  });
}

function inventoryKey(partId: string, color: string) {
  return `${partId}:${color.trim().toLowerCase()}`;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}
