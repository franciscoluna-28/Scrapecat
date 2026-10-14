import { env } from "@/config/env";
import { isProviderSupported } from "@/shared/integrations/providers/registry";
import * as settingsStore from "@/settings/stores/settings-store";
import type { AISettingsInput } from "@/settings/schemas";

export const GLOBAL_SETTINGS_ID = "global";

export type AISettings = {
  chatProvider: string;
  chatModel: string;
  embeddingProvider: string;
  embeddingModel: string;
};

export function defaultAISettings(): AISettings {
  return {
    chatProvider: "openrouter",
    chatModel: env.AI_MODEL,
    embeddingProvider: "openrouter",
    embeddingModel: env.EMBEDDING_MODEL,
  };
}

export async function getAISettings(): Promise<AISettings> {
  const row = await settingsStore.getSettings(GLOBAL_SETTINGS_ID);
  if (!row) return defaultAISettings();
  return {
    chatProvider: row.chatProvider,
    chatModel: row.chatModel,
    embeddingProvider: row.embeddingProvider,
    embeddingModel: row.embeddingModel,
  };
}

export async function updateAISettings(input: AISettingsInput): Promise<AISettings> {
  if (!isProviderSupported(input.chatProvider)) {
    throw new Error(`Unsupported provider: ${input.chatProvider}`);
  }
  if (!isProviderSupported(input.embeddingProvider)) {
    throw new Error(`Unsupported embedding provider: ${input.embeddingProvider}`);
  }

  await settingsStore.upsertSettings({
    id: GLOBAL_SETTINGS_ID,
    chatProvider: input.chatProvider,
    chatModel: input.chatModel,
    embeddingProvider: input.embeddingProvider,
    embeddingModel: input.embeddingModel,
  });

  return getAISettings();
}
