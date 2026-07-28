import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { credentials } from "../db/schema";
import { encrypt, decrypt, maskApiKey } from "./encryption";
import { isProviderSupported, getProviderConfig } from "../providers/registry";

export const DEFAULT_MODALITIES = ["language"];

export type CredentialRow = {
  id: string;
  provider: string;
  name: string;
  encryptedKey: string;
  keyHint: string;
  modalities: string[];
  createdAt: Date;
  updatedAt: Date;
};

export function toSafeCredential(row: typeof credentials.$inferSelect) {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    keyHint: row.keyHint,
    modalities: (row.modalities ?? DEFAULT_MODALITIES) as string[],
    createdAt: row.createdAt,
  };
}

export async function listCredentials(provider?: string): Promise<ReturnType<typeof toSafeCredential>[]> {
  const query = db
    .select()
    .from(credentials)
    .orderBy(desc(credentials.createdAt));

  if (provider) {
    query.where(eq(credentials.provider, provider));
  }

  const rows = await query;
  return rows.map(toSafeCredential);
}

export async function getCredential(id: string) {
  const row = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row ?? null;
}

export async function createCredential(data: {
  provider: string;
  name?: string;
  key: string;
}): Promise<string> {
  if (!isProviderSupported(data.provider)) {
    throw new Error(`Unsupported provider: ${data.provider}`);
  }

  const id = nanoid();
  const now = new Date();

  await db.insert(credentials).values({
    id,
    provider: data.provider,
    name: data.name || "Default",
    encryptedKey: encrypt(data.key),
    keyHint: maskApiKey(data.key),
    modalities: DEFAULT_MODALITIES,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function deleteCredential(id: string): Promise<boolean> {
  const result = await db
    .delete(credentials)
    .where(eq(credentials.id, id))
    .returning();
  return result.length > 0;
}

export async function verifyCredential(provider: string, key: string): Promise<boolean> {
  const config = getProviderConfig(provider);
  if (!config) return false;

  try {
    const res = await fetch(config.verifyUrl, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function resolveApiKey(provider: string): Promise<string | null> {
  const row = await db
    .select({ encryptedKey: credentials.encryptedKey })
    .from(credentials)
    .where(eq(credentials.provider, provider))
    .orderBy(desc(credentials.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;
  return decrypt(row.encryptedKey);
}
