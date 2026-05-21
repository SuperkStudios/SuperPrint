import { headers } from "next/headers";
import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import type { StaffPermission } from "@/domain/navigation";
import { sendAccountCreatedEmail, sendPasswordResetEmail } from "@/services/email";

const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        }
      }
    : {}),
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET
        }
      }
    : {})
};

export const auth = betterAuth({
  appName: "SuperPrint",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  trustedOrigins: trustedAuthOrigins(),
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl: url });
    },
    password: {
      hash: (password) => hash(password, 10),
      verify: ({ hash: storedHash, password }) => compare(password, storedHash)
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: 60 * 60 * 24,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAccountCreatedEmail({ email: user.email, name: user.name, verificationUrl: url });
    }
  },
  socialProviders,
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "CUSTOMER"
      },
      username: {
        type: "string",
        required: false,
        input: true
      },
      bio: {
        type: "string",
        required: false,
        input: true
      }
    }
  },
  plugins: [nextCookies()]
});

function trustedAuthOrigins() {
  return [
    process.env.BETTER_AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
}

export type AppSession = {
  session: { id: string; userId: string };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string | null;
    emailVerified?: boolean | null;
    staffPermissions?: unknown;
    username?: string | null;
    bio?: string | null;
  };
} | null;

export async function getCurrentSession(): Promise<AppSession> {
  const session = (await auth.api.getSession({
    headers: await headers()
  })) as AppSession;
  if (!session?.user.id) return session;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, emailVerified: true, staffPermissions: true }
  });
  return user
    ? { ...session, user: { ...session.user, role: user.role, emailVerified: user.emailVerified, staffPermissions: user.staffPermissions } }
    : session;
}

export function hasAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "OWNER";
}

export function hasStaffPermission(session: AppSession, permission?: StaffPermission) {
  const role = session?.user.role;
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "STAFF" || !permission) return false;
  const permissions = session?.user.staffPermissions;
  return Array.isArray(permissions) && permissions.map(String).includes(permission);
}

export function hasAnyStaffPermission(session: AppSession) {
  const role = session?.user.role;
  if (role === "OWNER" || role === "ADMIN") return true;
  return role === "STAFF" && Array.isArray(session?.user.staffPermissions) && session.user.staffPermissions.length > 0;
}
