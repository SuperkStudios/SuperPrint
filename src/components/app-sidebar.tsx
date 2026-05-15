import Link from "next/link";
import { buildAdminNavigation, buildUserNavigation } from "@/domain/navigation";

export function AppSidebar({ role, staffPermissions }: { role?: string | null; staffPermissions?: unknown }) {
  const userNav = buildUserNavigation(role);
  const adminNav = buildAdminNavigation(role, staffPermissions);

  if (!role) return null;

  return (
    <aside className="border-r bg-background/74 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]">
      <div className="grid gap-6 px-4 py-5 lg:w-56">
        <NavGroup title="Your Pages" items={userNav} />
        {adminNav.length ? <NavGroup title="Admin" items={adminNav} /> : null}
      </div>
    </aside>
  );
}

function NavGroup({ title, items }: { title: string; items: Array<{ href: string; label: string }> }) {
  return (
    <nav aria-label={title} className="grid gap-1">
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
