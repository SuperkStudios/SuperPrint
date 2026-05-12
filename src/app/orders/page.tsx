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

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view orders" copy="Order history, private queue status, and local media downloads are only available to the signed-in customer." />;
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: { product: true, upload: true, printJobs: true, videos: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Customer workspace</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Order history</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Track production status and retrieve finished print videos, timelapses, and thumbnails.</p>
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
            <CardContent className="grid gap-4 md:grid-cols-4">
              <p className="text-sm"><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</p>
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
                        <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>View video</a></Button>
                        {video.timelapseStorageKey ? <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.timelapseStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>Timelapse</a></Button> : null}
                        {video.thumbnailStorageKey ? <Button asChild size="sm" variant="outline"><a href={`/api/media/${createMediaToken({ key: video.thumbnailStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>Thumbnail</a></Button> : null}
                      </div>
                    ))
                  : <span className="text-muted-foreground">Pending completion</span>}
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No orders yet. Browse the store or upload a model to start a transparent print.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
