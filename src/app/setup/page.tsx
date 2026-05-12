import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
import { getBootstrapStatus } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const status = await getBootstrapStatus();
  if (status.isComplete) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">First-run setup</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bootstrap SuperPrint</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Create the owner account, company identity, first printer profile, opening filament stock, completed-print
        assignments, and security acknowledgement. This route locks permanently after an owner or admin exists.
      </p>
      <div className="mt-8">
        <SetupForm />
      </div>
    </main>
  );
}
