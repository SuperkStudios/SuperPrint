import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createMediaToken } from "@/lib/media-token";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Order history</h1>
        <p className="mt-3 text-muted-foreground">Sign in to view queue status and finished print videos.</p>
        <Button asChild className="mt-6"><Link href="/login">Sign in</Link></Button>
      </main>
    );
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: { product: true, upload: true, printJobs: true, videos: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Order history</h1>
      <div className="mt-8 grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{order.orderNumber}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{order.product?.name ?? order.upload?.fileName}</p>
              </div>
              <Badge>{order.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <p className="text-sm"><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</p>
              <p className="text-sm"><span className="text-muted-foreground">Print jobs</span><br />{order.printJobs.length}</p>
              <div className="text-sm">
                <span className="text-muted-foreground">Media</span><br />
                {order.videos.length
                  ? order.videos.map((video) => (
                      <div key={video.id} className="mt-1 flex flex-wrap gap-2">
                        <a className="underline" href={`/api/media/${createMediaToken({ key: video.storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>video</a>
                        {video.timelapseStorageKey ? <a className="underline" href={`/api/media/${createMediaToken({ key: video.timelapseStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>timelapse</a> : null}
                        {video.thumbnailStorageKey ? <a className="underline" href={`/api/media/${createMediaToken({ key: video.thumbnailStorageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>thumbnail</a> : null}
                      </div>
                    ))
                  : "Pending"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
