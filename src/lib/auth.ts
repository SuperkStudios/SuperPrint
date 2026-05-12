import { headers } from "next/headers";
import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

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
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: (password) => hash(password, 10),
      verify: ({ hash: storedHash, password }) => compare(password, storedHash)
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

export type AppSession = {
  session: { id: string; userId: string };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string | null;
    username?: string | null;
    bio?: string | null;
  };
} | null;

export async function getCurrentSession(): Promise<AppSession> {
  return (await auth.api.getSession({
    headers: await headers()
  })) as AppSession;
}

export function hasAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "OWNER";
}
