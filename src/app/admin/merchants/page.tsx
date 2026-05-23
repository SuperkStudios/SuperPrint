import { AdminMerchantReviewActions } from "@/components/admin-merchant-review-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMerchantsPage() {
  await requireAdminPage("orders");
  const applications = await prisma.merchantApplication.findMany({
    include: {
      user: { select: { email: true, name: true } },
      documents: { orderBy: { uploadedAt: "desc" } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Merchant applications</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Review submitted merchant onboarding, Stripe Connect state, and private document checklist before enabling Tap to Pay access.
        </p>
      </div>
      <div className="grid gap-4">
        {applications.length ? applications.map((application) => (
          <Card key={application.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{application.businessName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{application.user.name} · {application.user.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{application.status.replace(/_/g, " ")}</Badge>
                  <Badge className="bg-background">Connect {application.stripeConnectStatus.replace(/_/g, " ")}</Badge>
                  <Badge className="bg-background">{application.documents.length} docs</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Info label="Business type" value={application.businessType.replace(/_/g, " ")} />
                <Info label="Site" value={application.siteUrl} />
                <Info label="Tax" value={`${application.taxIdType} ending ${application.taxIdLast4}`} />
                <Info label="Stripe" value={application.stripeAccountId ?? "Not started"} />
                <Info label="Owner" value={`${application.ownerName} · ${application.ownerEmail}`} />
                <Info label="Phone" value={application.phone} />
                <Info label="Address" value={`${application.street1}${application.street2 ? ` ${application.street2}` : ""}, ${application.city}, ${application.state} ${application.zip}`} />
              </div>
              <div className="grid gap-2 text-sm">
                <span className="font-medium">Documents</span>
                {application.documents.length ? (
                  <div className="flex flex-wrap gap-2">
                    {application.documents.map((document) => (
                      <a key={document.id} href={`/api/admin/merchants/documents/${document.id}`}>
                        <Badge className="bg-background hover:bg-muted">{document.type.replace(/_/g, " ")} · {document.fileName}</Badge>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No documents uploaded yet.</p>
                )}
              </div>
              <AdminMerchantReviewActions id={application.id} />
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No merchant applications yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
