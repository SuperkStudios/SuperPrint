import { redirect } from "next/navigation";
import type { StaffPermission } from "@/domain/navigation";
import { getCurrentSession, hasStaffPermission } from "@/lib/auth";

export async function requireAdminPage(permission: StaffPermission) {
  const session = await getCurrentSession();
  if (!hasStaffPermission(session, permission)) redirect("/admin");
  return session;
}
