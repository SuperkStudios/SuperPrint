import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedField = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  value: string;
};

export function encryptSensitiveField(value: string): EncryptedField {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64")
  };
}

export function decryptSensitiveField(field: unknown) {
  if (!isEncryptedField(field)) return null;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(field.iv, "base64"));
  decipher.setAuthTag(Buffer.from(field.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(field.value, "base64")), decipher.final()]).toString("utf8");
}

function encryptionKey() {
  const configured = process.env.SUPERPRINT_FIELD_ENCRYPTION_KEY;
  if (configured) {
    const decoded = decodeKey(configured);
    if (decoded.length === 32) return decoded;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPERPRINT_FIELD_ENCRYPTION_KEY must be a 32-byte base64 or hex key in production.");
  }
  return createHash("sha256").update("superprint-dev-field-encryption-key").digest();
}

function decodeKey(value: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  return Buffer.from(trimmed, "base64");
}

function isEncryptedField(value: unknown): value is EncryptedField {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as EncryptedField).alg === "aes-256-gcm" &&
      typeof (value as EncryptedField).iv === "string" &&
      typeof (value as EncryptedField).tag === "string" &&
      typeof (value as EncryptedField).value === "string"
  );
}
