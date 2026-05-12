import { normalizePrimaryColor } from "@/domain/theme";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["company.brandName", "company.primaryColor", "filament.lowThresholdGrams"] } }
  });
  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Platform settings</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Update the public brand color and platform defaults used across SuperPrint.
        </p>
      </div>
      <AdminSettingsForm
        brandName={typeof values["company.brandName"] === "string" ? values["company.brandName"] : "SuperPrint"}
        primaryColor={normalizePrimaryColor(values["company.primaryColor"])}
        lowFilamentThresholdGrams={typeof values["filament.lowThresholdGrams"] === "number" ? values["filament.lowThresholdGrams"] : 150}
      />
    </div>
  );
}
