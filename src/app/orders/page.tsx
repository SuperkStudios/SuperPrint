import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createMediaToken } from "@/lib/media-token";
import { AuthRequired } from "@/components/auth-required";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { reconcilePaidStripeCheckoutSession } from "@/services/checkout";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ checkout?: string; order?: string; session_id?: string }> }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view orders" copy="Order history, private queue status, and local media downloads are only available to the signed-in customer." />;
  }
  const params = await searchParams;
  if (params?.checkout === "success") {
    await reconcilePaidStripeCheckoutSession({
      sessionId: params.session_id,
      orderId: params.order,
      actorId: session.user.id
    }).catch((error) => {
      console.error("Stripe checkout reconciliation failed", error);
    });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: { product: true, upload: true, printJobs: true, videos: true },
    orderBy: { createdAt: "desc" }
  });
  const rewardsBalance = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rewardsPointsBalance: true }
  });

  return (
    <PageShell>
      <PageSection className="max-w-6xl">
      <PageHero
        eyebrow="Customer workspace"
        title="Order history"
        copy={`Track production status, rewards, and finished print media. Rewards balance: ${rewardsBalance?.rewardsPointsBalance ?? 0} points.`}
      />
      <div className="mt-8 grid gap-4">
        {orders.length ? orders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{order.orderNumber}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{order.product?.name ?? order.upload?.fileName}</p>
              </div>
              <Badge>{order.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-6">
              <p className="text-sm"><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">Rewards</span><br />
                {order.rewardDiscountCents > 0 ? `${order.rewardPointsRedeemed} used, ${money(order.rewardDiscountCents)} off` : "No points used"}
                <br />
                {order.rewardPointsEarned > 0 ? `${order.rewardPointsEarned} earned` : "Pending payment"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Delivery</span><br />
                {order.fulfillmentMethod === "PICKUP" ? "Fort Collins pickup" : `${order.shippingProvider ?? "Shipping"} ${order.shippingService ?? ""}`}
                {order.trackingUrl ? <><br /><a className="text-primary underline-offset-4 hover:underline" href={order.trackingUrl}>Track package</a></> : null}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Upload</span><br />
                {order.upload ? `${order.upload.status}${order.upload.rejectionReason ? `: ${order.upload.rejectionReason}` : ""}` : "Product order"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Print jobs</span><br />
                {order.printJobs.length ? order.printJobs.map((job) => job.status).join(", ") : "Not queued"}
              </p>
              <div className="text-sm">
                <span className="text-muted-foreground">Media</span><br />
                {order.videos.length
                  ? order.videos.map((video) => (
                      <div key={video.id} className="mt-1 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>{video.storageKey.startsWith("timelapses/") ? "Timelapse" : "View video"}</a></Button>
                        {video.timelapseStorageKey && video.timelapseStorageKey !== video.storageKey ? <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.timelapseStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>Timelapse</a></Button> : null}
                        {video.thumbnailStorageKey ? <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.thumbnailStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>Thumbnail</a></Button> : null}
                      </div>
                    ))
                  : <span className="text-muted-foreground">Pending completion</span>}
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
