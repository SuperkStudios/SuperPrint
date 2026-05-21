import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { Clock3, Package, PlayCircle, UploadCloud, Video } from "lucide-react";
import { AuthRequired } from "@/components/auth-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { createMediaToken } from "@/lib/media-token";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view your dashboard" copy="Your dashboard shows orders, uploads, print status, and finished media." />;
  }

  const [orders, uploads, orderCount, uploadCount, activePrintCount, queuedJobCount, completedMediaCount, activeOrderCount] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: session.user.id },
      include: { product: true, items: { include: { product: true } }, upload: true, printJobs: { include: { filament: true }, orderBy: { queuePosition: "asc" } }, videos: true },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.modelUpload.findMany({
      where: { customerId: session.user.id },
      include: { sliceJobs: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.order.count({ where: { customerId: session.user.id } }),
    prisma.modelUpload.count({ where: { customerId: session.user.id } }),
    prisma.printJob.count({ where: { order: { customerId: session.user.id }, status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"] } } }),
    prisma.printJob.count({ where: { order: { customerId: session.user.id }, status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START"] } } }),
    prisma.orderVideo.count({ where: { order: { customerId: session.user.id } } }),
    prisma.order.count({ where: { customerId: session.user.id, status: { in: ["PAID", "QUEUED", "PRINTING"] } } })
  ]);

  const completedMedia = orders.flatMap((order) => order.videos.map((video) => ({ video, order })));

  return (
    <PageShell>
      <PageSection>
      <PageHero
        eyebrow="Customer dashboard"
        title={`Welcome${session.user.username ? `, ${session.user.username}` : ""}`}
        copy="Track store orders, custom uploads, live print status, and finished media from one place."
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/store">Browse store</Link></Button>
          <Button asChild variant="outline"><Link href="/upload">Upload STL</Link></Button>
        </div>
      </PageHero>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric icon={<Package className="h-4 w-4" />} label="Total orders" value={orderCount.toString()} detail={`${activeOrderCount} active`} />
        <Metric icon={<PlayCircle className="h-4 w-4" />} label="Production jobs" value={activePrintCount.toString()} detail={`${queuedJobCount} queued`} />
        <Metric icon={<UploadCloud className="h-4 w-4" />} label="Custom uploads" value={uploadCount.toString()} detail="Review requests" />
        <Metric icon={<Video className="h-4 w-4" />} label="Media ready" value={completedMediaCount.toString()} detail="Videos and timelapses" />
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
                    <p className="mt-1 text-sm text-muted-foreground">{orderTitle(order)}</p>
                  </div>
                  <Badge>{order.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <p><span className="text-muted-foreground">Total</span><br />{money(order.totalCents)}</p>
                  <p><span className="text-muted-foreground">Payment</span><br />{order.paymentStatus}</p>
                  <p><span className="text-muted-foreground">Colors</span><br />{orderColors(order)}</p>
                  <p><span className="text-muted-foreground">Print</span><br />{order.printJobs.length ? order.printJobs.map((job) => job.status).join(", ") : "Not queued yet"}</p>
                </div>
              </div>
            )) : (
              <EmptyState title="No orders yet" copy="Buy a catalog item or upload a model to start your first transparent print." />
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
              )) : <EmptyState title="No uploads" copy="Your STL review requests will show here." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Finished media</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {completedMedia.length ? completedMedia.slice(0, 4).map(({ video, order }) => (
                <div key={video.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <span>{order.orderNumber}</span>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/media/${createMediaToken({ key: video.storageKey, expiresAt: Date.now() + 60 * 60 * 1000 })}`}>{video.storageKey.startsWith("timelapses/") ? "Timelapse" : "View video"}</a>
                  </Button>
                </div>
              )) : <EmptyState title="No media ready" copy="Completed print videos and timelapses will appear here." />}
            </CardContent>
          </Card>
        </div>
      </div>
      </PageSection>
    </PageShell>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
          <Clock3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-4 text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function orderTitle(order: { items: Array<{ quantity: number; product: { name: string } }>; product?: { name: string } | null; upload?: { fileName: string } | null }) {
  if (order.items.length) return order.items.map((item) => `${item.quantity} x ${item.product.name}`).join(", ");
  return order.product?.name ?? order.upload?.fileName ?? "Custom print";
}

function orderColors(order: { printJobs: Array<{ filament?: { color: string; material: string } | null }>; selectedColors: unknown; selectedColor?: string | null }) {
  const jobColors = order.printJobs.map((job) => job.filament ? `${job.filament.color} ${job.filament.material}` : null).filter(Boolean);
  if (jobColors.length) return [...new Set(jobColors)].join(", ");
  const selectedColors = Array.isArray(order.selectedColors) ? order.selectedColors.filter((color): color is string => typeof color === "string") : [];
  return selectedColors.length ? selectedColors.join(", ") : order.selectedColor ?? "-";
}
