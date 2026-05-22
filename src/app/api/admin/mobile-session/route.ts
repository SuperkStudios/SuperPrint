import { NextResponse } from "next/server";
import { getCurrentSession, hasAnyStaffPermission } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return NextResponse.json({ signedIn: false });
  }
  return NextResponse.json({
    signedIn: true,
    user: {
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      emailVerified: Boolean(session.user.emailVerified),
      adminAllowed: hasAnyStaffPermission(session)
    }
  });
}
