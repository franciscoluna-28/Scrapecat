import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { appSettings } from "@/db/schema";

export type SettingsInput = {
  id: string;
  chatProvider: string;
  chatModel: string;
  embeddingProvider: string;
  embeddingModel: string;
};

export type SettingsRow = typeof appSettings.$inferSelect;

export function createSettingsStore(client: DbOrTx = db) {
  return {
    async getSettings(id: string): Promise<SettingsRow | null> {
      const [row] = await client
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, id))
        .limit(1);
      return row ?? null;
    },

    async upsertSettings(input: SettingsInput): Promise<SettingsRow> {
      const [row] = await client
        .insert(appSettings)
        .values(input)
        .onConflictDoUpdate({
          target: appSettings.id,
          set: {
            chatProvider: input.chatProvider,
            chatModel: input.chatModel,
            embeddingProvider: input.embeddingProvider,
            embeddingModel: input.embeddingModel,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },
  };
}

export const settingsStore = createSettingsStore();
