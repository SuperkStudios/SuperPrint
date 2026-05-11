import { AdminActionButton } from "@/components/admin-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUploadsPage() {
  const uploads = await prisma.modelUpload.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" }
  });

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
                {upload.contentType ?? "content type unknown"} · {upload.storageKey}
              </p>
            </div>
            <Badge>{upload.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{upload.notes ?? "No customer notes"}</p>
            <div className="flex flex-wrap gap-3">
              <AdminActionButton
                endpoint="/api/admin/uploads"
                payload={{
                  uploadId: upload.id,
                  action: "approve",
                  estimatedPriceCents: 4200,
                  estimatedPrintMinutes: 140
                }}
              >
                Approve
              </AdminActionButton>
              <AdminActionButton
                endpoint="/api/admin/uploads"
                payload={{ uploadId: upload.id, action: "reject", rejectionReason: "Model needs revision." }}
              >
                Reject
              </AdminActionButton>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
