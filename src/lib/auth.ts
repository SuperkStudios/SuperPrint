import { headers } from "next/headers";
import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { importPKCS8, SignJWT } from "jose";
import { prisma } from "./prisma";
import type { StaffPermission } from "@/domain/navigation";
import { sendAccountCreatedEmail, sendPasswordResetEmail } from "@/services/email";

const socialProviders = await buildSocialProviders();

async function buildSocialProviders() {
  const generatedAppleClientSecret = await resolveAppleClientSecret();
  return {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        }
      }
    : {}),
  ...(process.env.APPLE_CLIENT_ID && generatedAppleClientSecret
    ? {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: generatedAppleClientSecret,
          appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER
        }
      }
    : {})
  };
}

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
    "https://print.superk.studio",
    "https://appleid.apple.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveAppleClientSecret() {
  if (process.env.APPLE_CLIENT_SECRET) return process.env.APPLE_CLIENT_SECRET;
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
    return null;
  }
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID)
    .setSubject(process.env.APPLE_CLIENT_ID)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 180)
    .sign(key);
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
  const requestHeaders = await headers();
  const session = (await auth.api.getSession({
    headers: requestHeaders
  })) as AppSession;
  if (!session?.user.id) return getBearerSession(requestHeaders);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, emailVerified: true, staffPermissions: true }
  });
  return user
    ? { ...session, user: { ...session.user, role: user.role, emailVerified: user.emailVerified, staffPermissions: user.staffPermissions } }
    : session;
}

async function getBearerSession(requestHeaders: Headers): Promise<AppSession> {
  const token = bearerToken(requestHeaders);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          emailVerified: true,
          staffPermissions: true,
          username: true,
          bio: true
        }
      }
    }
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return {
    session: { id: session.id, userId: session.userId },
    user: session.user
  };
}

function bearerToken(requestHeaders: Headers) {
  const explicit = requestHeaders.get("x-superprint-session-token")?.trim();
  if (explicit) return explicit;
  const authorization = requestHeaders.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
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
