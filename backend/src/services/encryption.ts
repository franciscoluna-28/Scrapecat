import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV strictly following NIST SP 800-38D
const TAG_LENGTH = 16; // 128-bit authentication tag

function getMasterKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set in environment");
  }

  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte value (use: openssl rand -base64 32)");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decrypt(encoded: string): string {
  const key = getMasterKey();
  const buf = Buffer.from(encoded, "base64url");

  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid or corrupted ciphertext payload");
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return decipher.update(encrypted) + decipher.final("utf-8");
  } catch {
    throw new Error("Failed to decrypt: Payload integrity compromise or invalid key");
  }
}

export function maskApiKey(key: string): string {
  const cleaned = key.trim();
  if (cleaned.length <= 8) return "••••" + cleaned.slice(-2);
  return cleaned.slice(0, 4) + "••••••••" + cleaned.slice(-4);
}
