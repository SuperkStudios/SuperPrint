import { NextResponse } from "next/server";
import type { StaffPermission } from "@/domain/navigation";
import { getCurrentSession, hasAnyStaffPermission, hasStaffPermission } from "./auth";

export async function requireAdmin(permission?: StaffPermission) {
  const session = await getCurrentSession();
  const allowed = permission ? hasStaffPermission(session, permission) : hasAnyStaffPermission(session);
  if (!allowed) {
    return {
      session: null,
      response: NextResponse.json({ error: "Admin permission required" }, { status: 403 })
    };
  }

  return { session, response: null };
}

export async function requireCustomer() {
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return {
      session: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 })
    };
  }

  return { session, response: null };
}
