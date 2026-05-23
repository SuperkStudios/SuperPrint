import { createHmac, timingSafeEqual } from "node:crypto";

export type MediaTokenPayload = {
  key: string;
  expiresAt: number;
};

export function createMediaToken(payload: MediaTokenPayload, secret = getMediaSecret()) {
  const body = base64Url(JSON.stringify(payload));
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function readMediaToken(token: string, secret = getMediaSecret(), now = Date.now()): MediaTokenPayload {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new Error("Invalid media token");
  }

  const expected = sign(body, secret);
  if (!safeEqual(signature, expected)) {
    throw new Error("Invalid media token");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MediaTokenPayload;
  if (payload.expiresAt < now) {
    throw new Error("Media token expired");
  }
  return payload;
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function getMediaSecret() {
  const secret = process.env.MEDIA_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MEDIA_TOKEN_SECRET, BETTER_AUTH_SECRET, or NEXTAUTH_SECRET must be at least 32 characters in production.");
  }
  return "dev-media-secret";
}
