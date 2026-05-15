import { redirect } from "next/navigation";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession, hasAnyStaffPermission } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!hasAnyStaffPermission(session)) {
    redirect("/login");
  }

  return (
    <PageShell>
      <PageSection>
        <PageHero
          eyebrow="Admin operations"
          title="Printer control plane"
          copy="Operator tools for queue work, filament swaps, packaging, shipping, and production controls."
        />
        <div className="mt-8">{children}</div>
      </PageSection>
    </PageShell>
  );
}
