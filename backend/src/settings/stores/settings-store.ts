import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

export type SettingsInput = {
  id: string;
  chatProvider: string;
  chatModel: string;
  embeddingProvider: string;
  embeddingModel: string;
};

export async function getSettings(id: string) {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, id))
    .limit(1);
  return row ?? null;
}

export async function upsertSettings(input: SettingsInput) {
  const [row] = await db
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
}
