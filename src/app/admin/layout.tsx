import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession, hasAdminRole } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/printers", label: "Printers" },
  { href: "/admin/uploads", label: "Uploads" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/history", label: "History" },
  { href: "/admin/filament", label: "Filament" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/settings", label: "Settings" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!hasAdminRole(session?.user.role)) {
    redirect("/login");
  }

  return (
    <PageShell>
      <PageSection>
        <PageHero
          eyebrow="Admin operations"
          title="Printer control plane"
          copy="These controls are role-gated and never exposed through public queue APIs."
        >
        <nav className="flex flex-wrap gap-2">
          {adminNav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded border bg-card/70 px-3 py-2 text-sm hover:bg-muted">
              {item.label}
            </Link>
          ))}
        </nav>
        </PageHero>
        <div className="mt-8">{children}</div>
      </PageSection>
    </PageShell>
  );
}
