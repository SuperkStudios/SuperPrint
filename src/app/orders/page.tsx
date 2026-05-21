import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createMediaToken } from "@/lib/media-token";
import { AuthRequired } from "@/components/auth-required";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { reconcilePaidPaymentIntent, reconcilePaidStripeCheckoutSession } from "@/services/checkout";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ checkout?: string; order?: string; session_id?: string; payment_intent?: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view orders" copy="Order history, private queue status, and local media downloads are only available to the signed-in customer." />;
  }
  const params = await searchParams;
  if (params?.checkout === "success") {
    try {
      await reconcilePaidStripeCheckoutSession({
        sessionId: params.session_id,
        orderId: params.order,
        actorId: session.user.id
      });
      await reconcilePaidPaymentIntent({
        paymentIntentId: params.payment_intent,
        actorId: session.user.id
      });
    } catch (error) {
      console.error("Stripe checkout reconciliation failed", error);
    }
  }

  const [orders, orderSequence, rewardsBalance] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: session.user.id },
      include: {
        product: true,
        items: { include: { product: true } },
        printJobs: { orderBy: { createdAt: "asc" } },
        videos: true
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.order.findMany({
      where: { customerId: session.user.id },
      select: { id: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { rewardsPointsBalance: true }
    })
  ]);
  const orderNumberById = new Map(orderSequence.map((order, index) => [order.id, index + 1]));

  return (
    <PageShell>
      <PageSection className="max-w-6xl">
        <PageHero
          eyebrow="Customer workspace"
          title="Order history"
          copy={`Track production status, delivery, rewards, invoices, and finished print media. Rewards balance: ${rewardsBalance?.rewardsPointsBalance ?? 0} points.`}
        />
        <div className="mt-8 grid gap-4">
          {orders.length ? orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="grid gap-5 p-5">
                <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)_9rem] md:items-center">
                  <div>
                    <Link href={`/orders/${order.id}/invoice`} className="text-xl font-semibold hover:text-primary">
                      Order #{orderNumberById.get(order.id) ?? "-"}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{order.orderNumber}</p>
                    <Badge className="mt-3">{humanStatus(order.status)}</Badge>
                  </div>

                  <OrderProductSummary order={order} />

                  <div className="md:text-right">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
                    <p className="mt-1 text-2xl font-semibold">{money(order.totalCents)}</p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href={`/orders/${order.id}/invoice`}>
                        <FileText className="h-4 w-4" />
                        Invoice
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 border-t pt-4 md:grid-cols-4">
                  <InfoBlock label="Rewards">
                    <RewardsLine redeemed={order.rewardPointsRedeemed} discountCents={order.rewardDiscountCents} earned={order.rewardPointsEarned} />
                  </InfoBlock>
                  <InfoBlock label="Delivery">
                    <DeliveryLine order={order} />
                  </InfoBlock>
                  <InfoBlock label="Print status">
                    <PrintStatusLine jobs={order.printJobs} orderStatus={order.status} />
                  </InfoBlock>
                  <InfoBlock label="Media">
                    <MediaLinks videos={order.videos} />
                  </InfoBlock>
                </div>
              </CardContent>
            </Card>
          )) : (
            <EmptyState title="No orders yet" copy="Browse the store or upload a model to start a transparent print." />
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}

function OrderProductSummary({ order }: { order: {
  product?: { name: string; slug: string; imageUrl: string } | null;
  items: Array<{ quantity: number; product: { name: string; slug: string; imageUrl: string } }>;
} }) {
  const firstItem = order.items[0];
  const product = firstItem?.product ?? order.product;
  const title = order.items.length
    ? order.items.map((item) => `${item.quantity} x ${item.product.name}`).join(", ")
    : product ? `1 x ${product.name}` : "Custom order";

  return (
    <div className="flex items-center gap-4">
      {product ? (
        <Link href={`/store/${product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted/20">
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        </Link>
      ) : (
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md border bg-muted/20 text-xs text-muted-foreground">Custom</div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        {product ? (
          <Link href={`/store/${product.slug}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            View product <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function RewardsLine({ redeemed, discountCents, earned }: { redeemed: number; discountCents: number; earned: number }) {
  if (redeemed > 0 || discountCents > 0) {
    return <span className="font-medium text-red-500">Used {redeemed} pts{discountCents ? ` (${money(discountCents)} off)` : ""}</span>;
  }
  if (earned > 0) return <span className="font-medium text-emerald-500">Earned {earned} pts</span>;
  return <span className="text-muted-foreground">Pending payment</span>;
}

function DeliveryLine({ order }: { order: {
  fulfillmentMethod: string;
  shippingProvider: string | null;
  shippingService: string | null;
  trackingUrl: string | null;
  trackingNumber: string | null;
} }) {
  if (order.fulfillmentMethod === "PICKUP") return <span>Pickup</span>;
  return (
    <span>
      {[order.shippingProvider, order.shippingService].filter(Boolean).join(" ") || "Shipping"}
      {order.trackingUrl ? (
        <>
          <br />
          <a href={order.trackingUrl} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
            Track package <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      ) : order.trackingNumber ? (
        <><br /><span className="text-muted-foreground">{order.trackingNumber}</span></>
      ) : null}
    </span>
  );
}

function PrintStatusLine({ jobs, orderStatus }: { jobs: Array<{ status: string; queuePosition: number | null }>; orderStatus: string }) {
  if (!jobs.length) return <span>{humanStatus(orderStatus)}</span>;
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  const summary = [...counts.entries()].map(([status, count]) => `${count > 1 ? `${count} ` : ""}${humanStatus(status)}`).join(", ");
  const queued = jobs.map((job) => job.queuePosition).filter((position): position is number => typeof position === "number").sort((a, b) => a - b);
  return <span>{summary}{queued.length ? <><br /><span className="text-muted-foreground">Queue #{queued.join(", #")}</span></> : null}</span>;
}

function MediaLinks({ videos }: { videos: Array<{ id: string; storageKey: string; timelapseStorageKey: string | null }> }) {
  if (!videos.length) return <span className="text-muted-foreground">Pending completion</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {videos.map((video) => {
        const key = video.timelapseStorageKey ?? video.storageKey;
        const token = createMediaToken({ key, expiresAt: Date.now() + 60 * 60 * 1000 });
        return (
          <Button key={video.id} asChild size="sm" variant="outline">
            <a href={`/api/media/${token}`}>
              <Download className="h-4 w-4" />
              Timelapse
            </a>
          </Button>
        );
      })}
    </div>
  );
}

function humanStatus(status: string) {
  return status.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
