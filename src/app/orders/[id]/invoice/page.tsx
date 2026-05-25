import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { emailSettingKeys, resolveEmailSettings } from "@/domain/email-templates";
import { resolveShippoSettings, shippoSettingKeys } from "@/domain/shippo-settings";
import { getCurrentSession, hasStaffPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthRequired } from "@/components/auth-required";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { PageSection, PageShell } from "@/components/cyber-page";
import { PrintPageButton } from "@/components/print-page-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view invoice" copy="Invoices are only available to the customer who placed the order." />;
  }

  const { id } = await params;
  const canViewAllOrders = hasStaffPermission(session, "orders");
  const settingsKeys = ["company.brandName", ...shippoSettingKeys(), ...emailSettingKeys()];
  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: canViewAllOrders ? { id } : { id, customerId: session.user.id },
      include: {
        customer: true,
        product: true,
        upload: true,
        items: { include: { product: true } },
        printJobs: { orderBy: { createdAt: "asc" } },
        pricingSnapshot: true
      }
    }),
    prisma.systemSetting.findMany({ where: { key: { in: settingsKeys } } })
  ]);
  if (!order) notFound();

  const settingsValues = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const shippoSettings = resolveShippoSettings({ settings: settingsValues });
  const emailSettings = resolveEmailSettings(settingsValues);
  const business = buildBusinessInfo({
    brandName: settingString(settingsValues["company.brandName"]) ?? emailSettings.brandName,
    supportEmail: emailSettings.supportFrom,
    originAddress: shippoSettings.originAddress
  });

  const sequence = await prisma.order.count({
    where: { customerId: order.customerId, createdAt: { lte: order.createdAt } }
  });
  const invoiceNumber = `INV-${order.orderNumber}`;
  const invoiceLines = buildInvoiceLines(order);
  const paidOrTotal = order.amountPaidCents > 0 ? order.amountPaidCents : order.paymentStatus === "PAID" ? order.totalCents : 0;
  const dueCents = Math.max(0, order.totalCents - paidOrTotal);

  return (
    <PageShell>
      <PageSection className="max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline"><Link href={canViewAllOrders ? "/admin/orders" : "/orders"}>Back to orders</Link></Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{humanStatus(order.status)}</Badge>
            <PrintPageButton />
          </div>
        </div>

        <Card className="print:border-0 print:shadow-none">
          <CardContent className="grid gap-8 p-6 md:p-8 print:p-0">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-medium uppercase text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Invoice
                </div>
                <h1 className="mt-2 text-3xl font-semibold">{invoiceNumber}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Order #{sequence} · {order.orderNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">Issued {formatDate(order.createdAt)}</p>
              </div>
              <div className="text-sm md:text-right">
                <p className="text-lg font-semibold">{business.name}</p>
                {business.lines.map((line, index) => <p key={`${line}-${index}`} className="text-muted-foreground">{line}</p>)}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <AddressBlock title="Customer" lines={[
                order.customer.name || order.shippingName || order.customer.email,
                order.customer.email,
                order.shippingPhone
              ]} />
              <AddressBlock title="Bill to" lines={[
                order.shippingName || order.customer.name || order.customer.email,
                order.shippingEmail || order.customer.email,
                order.shippingPhone
              ]} />
              <AddressBlock title={order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Ship to"} lines={order.fulfillmentMethod === "PICKUP" ? [
                `${shippoSettings.pickupCity}, ${shippoSettings.pickupState} pickup`,
                business.pickupLine
              ] : [
                order.shippingName,
                order.shippingStreet1,
                order.shippingStreet2,
                cityStateZip(order.shippingCity, order.shippingState, order.shippingZip),
                order.shippingCountry,
                order.shippingPhone
              ]} />
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/15 p-4 text-sm md:grid-cols-4 print:bg-transparent">
              <InfoBlock label="Payment status" value={humanStatus(order.paymentStatus)} />
              <InfoBlock label="Payment method" value={paymentMethodLabel(order)} />
              <InfoBlock label="Fulfillment" value={order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Shipping"} />
              <InfoBlock label="Order source" value={humanStatus(order.orderSource)} />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1fr_80px_120px_120px_120px] gap-4 border-b pb-2 text-xs font-medium uppercase text-muted-foreground">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Tax / fees</span>
                  <span className="text-right">Line total</span>
                </div>
                {invoiceLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[1fr_80px_120px_120px_120px] gap-4 border-b py-4 text-sm">
                    <div className="flex items-center gap-3">
                      {line.href && line.imageUrl ? (
                        <Link href={line.href} className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/20 print:hidden">
                          <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                        </Link>
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border bg-muted/20 text-xs text-muted-foreground print:hidden">Custom</div>
                      )}
                      <div>
                        {line.href ? (
                          <Link href={line.href} className="font-medium hover:text-primary">{line.title}</Link>
                        ) : (
                          <p className="font-medium">{line.title}</p>
                        )}
                        {line.description ? <p className="text-xs text-muted-foreground">{line.description}</p> : null}
                      </div>
                    </div>
                    <span>{line.quantity}</span>
                    <span>{money(line.unitPriceCents)}</span>
                    <span>{line.taxCents || line.paymentFeeCents ? `${money(line.taxCents)} / ${money(line.paymentFeeCents)}` : "-"}</span>
                    <span className="text-right">{money(line.totalCents)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_22rem]">
              <div className="grid content-start gap-2 text-sm">
                <p><span className="text-muted-foreground">Paid:</span> {money(paidOrTotal)}{order.paidAt ? ` on ${formatDate(order.paidAt)}` : ""}</p>
                <p><span className="text-muted-foreground">Balance due:</span> {money(dueCents)}</p>
                {order.paymentReference ? <p><span className="text-muted-foreground">Payment ref:</span> {order.paymentReference}</p> : null}
                {order.trackingUrl ? <p><a href={order.trackingUrl} className="text-primary underline-offset-4 hover:underline">Track package</a></p> : order.trackingNumber ? <p><span className="text-muted-foreground">Tracking:</span> {order.trackingNumber}</p> : null}
                {order.printJobs.length ? <p><span className="text-muted-foreground">Print status:</span> {summarizePrintJobs(order.printJobs)}</p> : null}
                <p className="pt-2 text-xs text-muted-foreground">Thank you for printing with {business.name}. Keep this invoice for your records.</p>
              </div>

              <div className="grid gap-2 text-sm">
                <InvoiceLine label="Items subtotal" value={order.subtotalCents} />
                {order.rewardDiscountCents ? <InvoiceLine label={`Rewards used (${order.rewardPointsRedeemed} pts)`} value={-order.rewardDiscountCents} /> : null}
                <InvoiceLine label="Tax collected" value={order.taxCents} />
                <InvoiceLine label={order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Shipping"} value={order.shippingAmountCents} />
                <InvoiceLine label="Card processing fee" value={order.paymentFeeCents} />
                <div className="mt-2 flex items-center justify-between border-t pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>{money(order.totalCents)}</span>
                </div>
                <InvoiceLine label="Paid" value={-paidOrTotal} />
                <div className="flex items-center justify-between border-t pt-3 font-semibold">
                  <span>Amount due</span>
                  <span>{money(dueCents)}</span>
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

function buildBusinessInfo({ brandName, supportEmail, originAddress }: {
  brandName: string;
  supportEmail: string;
  originAddress: {
    name: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string | null;
    email?: string | null;
  } | null;
}) {
  const name = originAddress?.name || brandName || "SuperPrint";
  const addressLines = originAddress ? [
    originAddress.street1,
    originAddress.street2,
    cityStateZip(originAddress.city, originAddress.state, originAddress.zip),
    originAddress.country,
    originAddress.phone,
    originAddress.email || supportEmail
  ] : [
    "Fort Collins, CO",
    supportEmail,
    "print.superk.studio"
  ];
  return {
    name,
    lines: addressLines.map((line) => line?.trim()).filter((line): line is string => Boolean(line)),
    pickupLine: originAddress ? `${originAddress.street1}, ${cityStateZip(originAddress.city, originAddress.state, originAddress.zip)}` : "Pickup details provided by SuperPrint"
  };
}

function buildInvoiceLines(order: {
  product?: { name: string; slug: string; imageUrl: string } | null;
  upload?: { fileName: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
    taxCents: number;
    paymentFeeCents: number;
    totalCents: number;
    selectedColors: unknown;
    selectedColor: string | null;
    selectedMaterial: string | null;
    product: { name: string; slug: string; imageUrl: string };
  }>;
  subtotalCents: number;
  taxCents: number;
  paymentFeeCents: number;
  totalCents: number;
  selectedColors: unknown;
  selectedColor: string | null;
  selectedMaterial: string | null;
}) {
  if (order.items.length) {
    return order.items.map((item) => ({
      id: item.id,
      title: item.product.name,
      href: `/store/${item.product.slug}`,
      imageUrl: item.product.imageUrl,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      taxCents: item.taxCents,
      paymentFeeCents: item.paymentFeeCents,
      totalCents: item.totalCents || item.subtotalCents + item.taxCents + item.paymentFeeCents,
      description: colorsLabel(item.selectedColors, item.selectedColor, item.selectedMaterial)
    }));
  }

  const title = order.product?.name ?? order.upload?.fileName ?? "Custom print order";
  return [{
    id: "order-line",
    title,
    href: order.product ? `/store/${order.product.slug}` : null,
    imageUrl: order.product?.imageUrl ?? null,
    quantity: 1,
    unitPriceCents: order.subtotalCents || order.totalCents,
    taxCents: order.taxCents,
    paymentFeeCents: order.paymentFeeCents,
    totalCents: order.totalCents,
    description: colorsLabel(order.selectedColors, order.selectedColor, order.selectedMaterial)
  }];
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function cityStateZip(city?: string | null, state?: string | null, zip?: string | null) {
  const place = [city, state].filter(Boolean).join(", ");
  return [place, zip].filter(Boolean).join(" ");
}

function paymentMethodLabel(order: {
  paymentMethod: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
}) {
  const method = humanStatus(order.paymentMethod);
  if (order.cardBrand && order.cardLast4) return `${humanStatus(order.cardBrand)} ending ${order.cardLast4}`;
  return method;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
