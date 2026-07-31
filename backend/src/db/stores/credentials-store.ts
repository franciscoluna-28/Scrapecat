import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { credentials, type CredentialProvider } from "../schema";

export type CredentialInput = {
  provider: CredentialProvider;
  name: string;
  encryptedKey: string;
  keyHint: string;
};

export async function insertCredential(input: CredentialInput) {
  const [row] = await db.insert(credentials).values(input).returning();
  return row;
}

export async function listCredentials(provider?: CredentialProvider) {
  const query = db.select().from(credentials);
  if (provider) {
    query.where(eq(credentials.provider, provider));
  }
  return query.orderBy(desc(credentials.createdAt));
}

export async function getCredentialById(id: string) {
  const [row] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteCredentialById(id: string) {
  const rows = await db
    .delete(credentials)
    .where(eq(credentials.id, id))
    .returning({ id: credentials.id });
  return rows.length > 0;
}

export async function getLatestCredential(provider: CredentialProvider) {
  const [row] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.provider, provider))
    .orderBy(desc(credentials.createdAt))
    .limit(1);
  return row ?? null;
}
