import { env } from "@/config/env";
import {
  isEmbeddingProviderSupported,
  isProviderSupported,
} from "@/shared/integrations/providers/registry";
import { logger } from "@/shared/logger";
import { getJobQueue } from "@/shared/queue";
import * as settingsStore from "@/settings/stores/settings-store";
import type { AISettingsInput } from "@/settings/schemas";

export const GLOBAL_SETTINGS_ID = "global";

const REINDEX_JOB_ID = "reindex-embeddings";

type EmbeddingReindexResult = {
  provider: string;
  model: string;
};

async function scheduleEmbeddingReindex() {
  try {
    const queue = await getJobQueue();
    await queue.enqueue("reindex-embeddings", REINDEX_JOB_ID, {});
    void queue
      .runAndWait<EmbeddingReindexResult>(REINDEX_JOB_ID)
      .then(async (result) => {
        const current = await getAISettings();
        if (
          current.embeddingProvider !== result.provider ||
          current.embeddingModel !== result.model
        ) {
          await scheduleEmbeddingReindex();
        }
      })
      .catch((error) => {
        logger.warn(
          { err: (error as Error)?.message ?? String(error) },
          "embedding reindex failed",
        );
      });
  } catch (error) {
    logger.warn(
      { err: (error as Error)?.message ?? String(error) },
      "embedding reindex could not be scheduled",
    );
  }
}

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
  if (!isEmbeddingProviderSupported(input.embeddingProvider)) {
    throw new Error(`Unsupported embedding provider: ${input.embeddingProvider}`);
  }

  const previous = await getAISettings();
  await settingsStore.upsertSettings({
    id: GLOBAL_SETTINGS_ID,
    chatProvider: input.chatProvider,
    chatModel: input.chatModel,
    embeddingProvider: input.embeddingProvider,
    embeddingModel: input.embeddingModel,
  });

  const updated = await getAISettings();
  if (
    previous.embeddingProvider !== updated.embeddingProvider ||
    previous.embeddingModel !== updated.embeddingModel
  ) {
    await scheduleEmbeddingReindex();
  }

  return updated;
}
