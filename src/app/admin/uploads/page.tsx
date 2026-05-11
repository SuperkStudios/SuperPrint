import { AdminActionButton } from "@/components/admin-action-button";
import { UploadReviewActions } from "@/components/upload-review-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUploadsPage() {
  const uploads = await prisma.modelUpload.findMany({
    include: { customer: true, sliceJobs: true, selectedPrinter: true },
    orderBy: { createdAt: "desc" }
  });
  const printers = await prisma.printer.findMany({ orderBy: { publicName: "asc" } });

  return (
    <div className="grid gap-4">
      {uploads.map((upload) => (
        <Card key={upload.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{upload.fileName}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{upload.customer.email}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {upload.fileSizeBytes ? `${Math.round(upload.fileSizeBytes / 1024)} KB` : "size unknown"} ·{" "}
                {upload.contentType ?? "content type unknown"} · checksum {upload.checksumSha256?.slice(0, 12) ?? "pending"}
              </p>
            </div>
            <Badge>{upload.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{upload.notes ?? "No customer notes"}</p>
            <div className="grid gap-2 text-sm md:grid-cols-4">
              <span>Material: {upload.selectedMaterial ?? "not selected"}</span>
              <span>Printer: {upload.selectedPrinter?.publicName ?? "not selected"}</span>
              <span>Estimate: {upload.estimatedPrintMinutes ?? "?"}m</span>
              <span>Grams: {upload.estimatedGrams ?? "?"}g</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {upload.sliceJobs.map((job) => (
                <Badge key={job.id} className="bg-secondary">Slice {job.status}</Badge>
              ))}
            </div>
            {upload.sliceJobs.some((job) => job.status === "READY") ? (
              <div className="flex flex-wrap gap-2">
                {upload.sliceJobs.filter((job) => job.status === "READY").map((job) => (
                  <AdminAdmitButton key={job.id} sliceJobId={job.id} />
                ))}
              </div>
            ) : null}
            {upload.status === "PENDING" ? <UploadReviewActions uploadId={upload.id} printers={printers} /> : null}
          </CardContent>
        </Card>
      ))}
      {uploads.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No uploads are waiting for review.</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AdminAdmitButton({ sliceJobId }: { sliceJobId: string }) {
  return (
    <AdminActionButton
      endpoint="/api/admin/slices"
      payload={{ action: "admit", sliceJobId }}
      confirm="Admit this sliced job to the live queue and reserve filament?"
    >
      Admit ready slice to queue
    </AdminActionButton>
  );
}
