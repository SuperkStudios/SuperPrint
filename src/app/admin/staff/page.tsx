import { StaffPermissionsForm } from "@/components/staff-permissions-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  await requireAdminPage("staff");
  const staff = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN", "STAFF"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Staff access</CardTitle>
          <p className="text-sm text-muted-foreground">Invite operators and restrict the admin work they can do.</p>
        </CardHeader>
        <CardContent>
          <StaffPermissionsForm staff={staff} />
        </CardContent>
      </Card>
    </div>
  );
}
