"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";

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
      <main className="min-w-0">{children}</main>
    </div>
  );
}
