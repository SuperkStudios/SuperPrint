import { notFound } from "next/navigation";
import { PrinterProfileForm } from "@/components/printer-profile-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditPrinterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [printer, spools] = await Promise.all([
    prisma.printer.findUnique({ where: { id } }),
    prisma.filamentSpool.findMany({ orderBy: [{ material: "asc" }, { color: "asc" }] })
  ]);
  if (!printer) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Edit printer profile</h2>
      <PrinterProfileForm printer={printer} spools={spools} />
    </div>
  );
}
