import { AdminFactoryEvolutionManager } from "@/components/factory/admin-factory-evolution-manager";
import { requireAdminPage } from "@/lib/admin-permissions";
import { getAdminFactoryEvolution } from "@/services/factory-evolution";

export const dynamic = "force-dynamic";

export default async function AdminFactoryEvolutionPage() {
  await requireAdminPage("factory");
  const data = await getAdminFactoryEvolution();

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Factory Evolution</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure public goals, manual progress, supporter tiers, milestones, and unlocked upgrades. Factory status stats are calculated from live platform data.
        </p>
      </div>
      <AdminFactoryEvolutionManager data={data} />
    </div>
  );
}
