import { UploadForm } from "@/components/upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthRequired } from "@/components/auth-required";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CyberCard, EmptyState, PageHero, PageSection, PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return (
      <AuthRequired
        title="Sign in to upload an STL"
        copy="Uploads become private customer jobs, so SuperPrint needs an account before accepting model files."
      />
    );
  }
  const uploads = await prisma.modelUpload.findMany({
    where: { customerId: session.user.id },
    include: { sliceJobs: true },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  return (
    <PageShell>
      <PageSection className="grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1.2fr]">
      <PageHero
        eyebrow="Custom print request"
        title="Upload an STL"
        copy="Custom models enter an approval queue. Once approved, SuperPrint creates a checkout-ready order with price, ETA, material, and queue placement."
        className="md:col-span-2"
      />
      <CyberCard>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="rounded-xl border bg-background/35 p-3">Accepted files: `.stl` up to 150MB.</p>
          <p className="rounded-xl border bg-background/35 p-3">Review includes material fit, printability, risk, ETA, and price.</p>
        </div>
      </CyberCard>
      <Card>
        <CardHeader>
          <CardTitle>Model approval request</CardTitle>
          <CardDescription>Files are written to the mounted local upload volume for operator review.</CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Your upload requests</CardTitle>
          <CardDescription>Status is updated as operators review and slice approved models.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {uploads.length ? uploads.map((upload) => (
            <div key={upload.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{upload.fileName}</p>
                <p className="text-muted-foreground">
                  {upload.status}
                  {upload.rejectionReason ? ` · ${upload.rejectionReason}` : ""}
                  {upload.sliceJobs[0] ? ` · Slice ${upload.sliceJobs[0].status}` : ""}
                </p>
              </div>
              <span className="text-muted-foreground">{upload.createdAt.toLocaleString()}</span>
            </div>
          )) : <EmptyState title="No uploads yet" copy="Your private model review requests will show here after your first STL upload." />}
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
