import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthRequired } from "@/components/auth-required";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { PageSection, PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view invoice" copy="Invoices are only available to the customer who placed the order." />;
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.id },
    include: {
      customer: true,
      product: true,
      items: { include: { product: true } },
      printJobs: { orderBy: { createdAt: "asc" } },
      pricingSnapshot: true
    }
  });
  if (!order) notFound();

  const sequence = await prisma.order.count({
    where: { customerId: session.user.id, createdAt: { lte: order.createdAt } }
  });

  return (
    <PageShell>
      <PageSection className="max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline"><Link href="/orders">Back to orders</Link></Button>
          <Badge>{humanStatus(order.status)}</Badge>
        </div>

        <Card>
          <CardContent className="grid gap-8 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
              <div>
                <p className="text-sm font-medium uppercase text-muted-foreground">Invoice</p>
                <h1 className="mt-1 text-3xl font-semibold">Order #{sequence}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Internal ref {order.orderNumber}</p>
              </div>
              <div className="text-sm md:text-right">
                <p className="font-semibold">SuperPrint</p>
                <p className="text-muted-foreground">Live manufacturing. Transparent by design.</p>
                <p className="text-muted-foreground">Fort Collins, CO</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <AddressBlock title="Billed to" lines={[
                order.customer.name || order.shippingName || order.customer.email,
                order.customer.email,
                order.shippingPhone
              ]} />
              <AddressBlock title={order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Ship to"} lines={order.fulfillmentMethod === "PICKUP" ? [
                "Fort Collins pickup"
              ] : [
                order.shippingName,
                order.shippingStreet1,
                order.shippingStreet2,
                [order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(", "),
                order.shippingCountry,
                order.shippingEmail
              ]} />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1fr_80px_110px_110px] gap-4 border-b pb-2 text-xs font-medium uppercase text-muted-foreground">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span className="text-right">Line total</span>
                </div>
                {(order.items.length ? order.items : []).map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_110px_110px] gap-4 border-b py-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/store/${item.product.slug}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/20">
                        <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                      </Link>
                      <div>
                        <Link href={`/store/${item.product.slug}`} className="font-medium hover:text-primary">{item.product.name}</Link>
                        <p className="text-xs text-muted-foreground">{colorsLabel(item.selectedColors, item.selectedColor, item.selectedMaterial)}</p>
                      </div>
                    </div>
                    <span>{item.quantity}</span>
                    <span>{money(item.unitPriceCents)}</span>
                    <span className="text-right">{money(item.subtotalCents)}</span>
                  </div>
                ))}
                {!order.items.length && order.product ? (
                  <div className="grid grid-cols-[1fr_80px_110px_110px] gap-4 border-b py-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/store/${order.product.slug}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/20">
                        <img src={order.product.imageUrl} alt="" className="h-full w-full object-cover" />
                      </Link>
                      <Link href={`/store/${order.product.slug}`} className="font-medium hover:text-primary">{order.product.name}</Link>
                    </div>
                    <span>1</span>
                    <span>{money(order.subtotalCents || order.totalCents)}</span>
                    <span className="text-right">{money(order.subtotalCents || order.totalCents)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
              <div className="grid content-start gap-2 text-sm">
                <p><span className="text-muted-foreground">Payment:</span> {humanStatus(order.paymentStatus)}</p>
                <p><span className="text-muted-foreground">Fulfillment:</span> {order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Shipping"}</p>
                {order.trackingUrl ? <p><a href={order.trackingUrl} className="text-primary underline-offset-4 hover:underline">Track package</a></p> : null}
                {order.printJobs.length ? <p><span className="text-muted-foreground">Print status:</span> {summarizePrintJobs(order.printJobs)}</p> : null}
              </div>

              <div className="grid gap-2 text-sm">
                <InvoiceLine label="Subtotal" value={order.subtotalCents} />
                {order.rewardDiscountCents ? <InvoiceLine label={`Rewards used (${order.rewardPointsRedeemed} pts)`} value={-order.rewardDiscountCents} /> : null}
                <InvoiceLine label="Taxes" value={order.taxCents} />
                <InvoiceLine label="Shipping / pickup" value={order.shippingAmountCents} />
                <InvoiceLine label="Payment processing" value={order.paymentFeeCents} />
                <div className="mt-2 flex items-center justify-between border-t pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>{money(order.totalCents)}</span>
                </div>
                {order.rewardPointsEarned > 0 && !order.rewardPointsRedeemed ? (
                  <p className="pt-2 text-sm font-medium text-emerald-500">Earned {order.rewardPointsEarned} rewards points</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </PageSection>
    </PageShell>
  );
}

function AddressBlock({ title, lines }: { title: string; lines: Array<string | null | undefined> }) {
  const cleanLines = lines.map((line) => line?.trim()).filter(Boolean);
  return (
    <div className="rounded-md border bg-muted/20 p-4 text-sm">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</p>
      {cleanLines.length ? cleanLines.map((line) => <p key={line}>{line}</p>) : <p className="text-muted-foreground">Not provided</p>}
    </div>
  );
}

function InvoiceLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value < 0 ? `-${money(Math.abs(value))}` : money(value)}</span>
    </div>
  );
}

function colorsLabel(selectedColors: unknown, selectedColor?: string | null, selectedMaterial?: string | null) {
  const colors = Array.isArray(selectedColors) ? selectedColors.filter((color): color is string => typeof color === "string") : [];
  return [colors.length ? colors.join(" + ") : selectedColor, selectedMaterial].filter(Boolean).join(" ");
}

function summarizePrintJobs(jobs: Array<{ status: string }>) {
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => `${count > 1 ? `${count} ` : ""}${humanStatus(status)}`).join(", ");
}

function humanStatus(status: string) {
  return status.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
