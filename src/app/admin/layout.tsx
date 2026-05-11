import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions, hasAdminRole } from "@/lib/auth";

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/uploads", label: "Uploads" },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/filament", label: "Filament" },
  { href: "/admin/maintenance", label: "Maintenance" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!hasAdminRole(session?.user.role)) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Admin operations</p>
          <h1 className="text-3xl font-semibold tracking-tight">Printer control plane</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            These controls are role-gated and never exposed through public queue APIs.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {adminNav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded border bg-white px-3 py-2 text-sm hover:bg-muted">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </main>
  );
}
