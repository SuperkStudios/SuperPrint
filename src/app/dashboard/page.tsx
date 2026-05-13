import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { createMediaToken } from "@/lib/media-token";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view your dashboard" copy="Your dashboard shows orders, uploads, print status, and finished media." />;
  }

  const [orders, uploads] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: session.user.id },
      include: { product: true, upload: true, printJobs: true, videos: true },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.modelUpload.findMany({
      where: { customerId: session.user.id },
      include: { sliceJobs: true },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const activePrints = orders.flatMap((order) =>
    order.printJobs
      .filter((job) => !["COMPLETED", "STOPPED", "FAILED", "CANCELED"].includes(job.status))
      .map((job) => ({ job, order }))
  );
  const completedMedia = orders.flatMap((order) => order.videos.map((video) => ({ video, order })));

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Customer dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome{session.user.username ? `, ${session.user.username}` : ""}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Track store orders, custom uploads, live print status, and finished media from one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/store">Browse store</Link></Button>
          <Button asChild variant="outline"><Link href="/upload">Upload STL</Link></Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Orders" value={orders.length.toString()} />
        <Metric label="Active prints" value={activePrints.length.toString()} />
        <Metric label="Uploads" value={uploads.length.toString()} />
        <Metric label="Media ready" value={completedMedia.length.toString()} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Orders and prints</CardTitle>
            <Button asChild size="sm" variant="outline"><Link href="/orders">View all</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {orders.length ? orders.map((order) => (
              <div key={order.id} className="rounded border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{order.product?.name ?? order.upload?.fileName ?? "Custom print"}</p>
                  </div>
                  <Badge>{order.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <p><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</p>
                  <p><span className="text-muted-foreground">Payment</span><br />{order.paymentStatus}</p>
                  <p><span className="text-muted-foreground">Print</span><br />{order.printJobs.length ? order.printJobs.map((job) => job.status).join(", ") : "Not queued yet"}</p>
                </div>
              </div>
            )) : (
              <Empty title="No orders yet" copy="Buy a catalog item or upload a model to start your first transparent print." />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Custom uploads</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {uploads.length ? uploads.map((upload) => (
                <div key={upload.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{upload.fileName}</p>
                    <Badge>{upload.status}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{upload.sliceJobs[0] ? `Slice ${upload.sliceJobs[0].status}` : "Waiting for operator review"}</p>
                </div>
              )) : <Empty title="No uploads" copy="Your STL review requests will show here." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Finished media</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {completedMedia.length ? completedMedia.slice(0, 4).map(({ video, order }) => (
                <div key={video.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <span>{order.orderNumber}</span>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/media/${createMediaToken({ key: video.storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>View video</a>
                  </Button>
                </div>
              )) : <Empty title="No media ready" copy="Completed print videos and timelapses will appear here." />}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded border border-dashed p-5 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{copy}</p>
    </div>
  );
}
