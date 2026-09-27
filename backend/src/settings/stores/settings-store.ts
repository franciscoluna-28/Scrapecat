import { eq } from "drizzle-orm";
import { db, isInMemoryMode } from "@/db/client";
import * as memory from "@/db/memory";
import { appSettings } from "@/db/schema";

export type SettingsInput = {
  id: string;
  reportProvider: string;
  reportModel: string;
  embeddingProvider: string;
  embeddingModel: string;
};

export async function getSettings(id: string) {
  if (isInMemoryMode) return memory.getSettings(id);
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, id))
    .limit(1);
  return row ?? null;
}

export async function upsertSettings(input: SettingsInput) {
  if (isInMemoryMode) return memory.upsertSettings(input);
  const [row] = await db
    .insert(appSettings)
    .values(input)
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        reportProvider: input.reportProvider,
        reportModel: input.reportModel,
        embeddingProvider: input.embeddingProvider,
        embeddingModel: input.embeddingModel,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
