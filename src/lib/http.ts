import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasAdminRole } from "./auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!hasAdminRole(session?.user.role)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Admin role required" }, { status: 403 })
    };
  }

  return { session, response: null };
}

export async function requireCustomer() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return {
      session: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 })
    };
  }

  return { session, response: null };
}
