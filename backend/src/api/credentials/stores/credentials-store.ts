import { desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { credentials, type CredentialProvider } from "@/db/schema";

export type CredentialInput = {
  provider: CredentialProvider;
  encryptedKey: string;
  keyHint: string;
};

export type CredentialRow = typeof credentials.$inferSelect;

export function createCredentialsStore(client: DbOrTx = db) {
  return {
    async upsertCredential(input: CredentialInput): Promise<CredentialRow> {
      const [row] = await client
        .insert(credentials)
        .values(input)
        .onConflictDoUpdate({
          target: credentials.provider,
          set: {
            encryptedKey: input.encryptedKey,
            keyHint: input.keyHint,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    async listCredentials(provider?: CredentialProvider): Promise<CredentialRow[]> {
      const conditions = provider ? eq(credentials.provider, provider) : undefined;
      return client
        .select()
        .from(credentials)
        .where(conditions)
        .orderBy(desc(credentials.createdAt));
    },

    async getCredentialById(id: string): Promise<CredentialRow | null> {
      const [row] = await client
        .select()
        .from(credentials)
        .where(eq(credentials.id, id))
        .limit(1);
      return row ?? null;
    },

    async deleteCredentialById(id: string): Promise<boolean> {
      const rows = await client
        .delete(credentials)
        .where(eq(credentials.id, id))
        .returning({ id: credentials.id });
      return rows.length > 0;
    },

    async getLatestCredential(provider: CredentialProvider): Promise<CredentialRow | null> {
      const [row] = await client
        .select()
        .from(credentials)
        .where(eq(credentials.provider, provider))
        .orderBy(desc(credentials.createdAt))
        .limit(1);
      return row ?? null;
    },
  };
}

export const credentialsStore = createCredentialsStore();
