import { PrinterProfileForm } from "@/components/printer-profile-form";
import { requireAdminPage } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewPrinterPage() {
  await requireAdminPage("printers");
  const spools = await prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { color: "asc" }] });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Add printer profile</h2>
      <PrinterProfileForm spools={spools} />
    </div>
  );
}
