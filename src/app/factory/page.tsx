import { redirect } from "next/navigation";
import { FactoryEvolutionDashboard } from "@/components/factory/factory-evolution-dashboard";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getPublicFactoryEvolution } from "@/services/factory-evolution";

export const dynamic = "force-dynamic";

export default async function FactoryPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  const data = await getPublicFactoryEvolution();
  return <FactoryEvolutionDashboard data={data} />;
}
