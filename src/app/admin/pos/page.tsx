import { AdminPosForm } from "@/components/admin-pos-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { getPricingSettings } from "@/services/pricing";

export const dynamic = "force-dynamic";

export default async function AdminPosPage() {
  await requireAdminPage("orders");
  const [products, todaysOrders, pricingSettings] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } },
      orderBy: { name: "asc" }
    }),
    prisma.order.findMany({
      where: {
        orderSource: { in: ["IN_PERSON", "PAST_IMPORT"] },
        createdAt: { gte: startOfToday() }
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" }
    }),
    getPricingSettings()
  ]);

  const collectedCents = todaysOrders.reduce((total, order) => total + order.amountPaidCents, 0);
  const taxAccountCents = todaysOrders
    .filter((order) => order.paymentStatus === "PAID" || order.amountPaidCents > 0)
    .reduce((total, order) => total + order.taxCents, 0);
  const cashTaxCents = todaysOrders
    .filter((order) => order.paymentMethod === "CASH" && (order.paymentStatus === "PAID" || order.amountPaidCents > 0))
    .reduce((total, order) => total + order.taxCents, 0);
  const netSalesCents = todaysOrders.reduce((total, order) => total + Math.max(0, order.amountPaidCents - order.taxCents - order.paymentFeeCents), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">In-person orders</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create counter sales, enter past cash or Stripe payments, and send paid work into production.</p>
        </div>
        <div className="grid min-w-48 gap-1 rounded-md border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Today collected</span>
          <strong className="text-xl">{money(collectedCents)}</strong>
          <span className="text-muted-foreground">Tax account: {money(taxAccountCents)} · cash tax {money(cashTaxCents)}</span>
          <span className="text-muted-foreground">Net after tax/fees: {money(netSalesCents)}</span>
        </div>
      </div>

      <AdminPosForm pricingSettings={{
        taxPercentEstimate: pricingSettings.taxPercentEstimate,
        paymentProcessingPercent: pricingSettings.paymentProcessingPercent,
        paymentProcessingFixedCents: pricingSettings.paymentProcessingFixedCents
      }} products={products.map((product) => ({
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        colorSlotCount: product.colorSlotCount,
        allowedFilaments: product.allowedFilaments.map((item) => ({
          filamentMaterialId: item.filamentMaterialId,
          filamentMaterial: {
            color: item.filamentMaterial.color,
            material: item.filamentMaterial.material
          }
        }))
      }))} />

      <section className="grid gap-3">
        <h3 className="text-lg font-semibold">Recent counter orders</h3>
        {todaysOrders.length ? todaysOrders.slice(0, 8).map((order) => (
          <Card key={order.id}>
            <CardContent className="grid gap-2 p-4 text-sm md:grid-cols-[120px_1fr_120px_120px_120px]">
              <strong>{order.orderNumber}</strong>
              <span>{order.customer.name} · {order.customer.email}</span>
              <span>{order.paymentMethod}</span>
              <span>{money(order.amountPaidCents)}</span>
              <span>tax {money(order.taxCents)}</span>
            </CardContent>
          </Card>
        )) : <Card><CardContent className="p-5 text-sm text-muted-foreground">No in-person orders entered today.</CardContent></Card>}
      </section>
    </div>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
