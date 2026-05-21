"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteFooter } from "@/components/site-footer";

const sidebarRoutes = ["/admin", "/dashboard", "/upload", "/orders", "/profile"];

export function AppFrame({
  role,
  staffPermissions,
  children
}: {
  role?: string | null;
  staffPermissions?: unknown;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showSidebar = Boolean(role && sidebarRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)));

  return (
    <div className={showSidebar ? "lg:grid lg:grid-cols-[auto_1fr]" : ""}>
      {showSidebar ? <AppSidebar role={role} staffPermissions={staffPermissions} /> : null}
      <div className="min-w-0">
        <main>{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
