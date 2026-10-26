import OpenAI from "openai";
import { env } from "@/config/env";
import { resolveApiKey } from "@/credentials/services";
import { getAISettings } from "@/settings/services";
import {
  getProviderConfig,
  isEmbeddingProviderSupported,
} from "@/shared/integrations/providers/registry";
import { logger } from "@/shared/logger";

const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingSpace = {
  provider: string;
  model: string;
};

export async function resolveEmbeddingSpace(
  opts?: { provider?: string; model?: string },
): Promise<EmbeddingSpace> {
  if (opts?.provider && opts?.model) {
    return { provider: opts.provider, model: opts.model };
  }

  const settings = await getAISettings();
  return {
    provider: opts?.provider || settings.embeddingProvider,
    model: opts?.model || settings.embeddingModel,
  };
}

export async function embedTexts(
  texts: string[],
  opts?: { model?: string; apiKey?: string; provider?: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { provider, model } = await resolveEmbeddingSpace(opts);
  const config = getProviderConfig(provider);

  if (!isEmbeddingProviderSupported(provider) || !config) {
    throw new Error(`Unsupported embedding provider: ${provider}`);
  }

  const apiKey =
    opts?.apiKey ||
    (await resolveApiKey(provider)) ||
    (env as unknown as Record<string, string>)[config.envKey] ||
    "";

  const baseURL =
    provider === "ollama"
      ? `${env.OLLAMA_BASE_URL}/v1`
      : "baseUrl" in config
        ? config.baseUrl
        : "https://openrouter.ai/api/v1";

  const client = new OpenAI({
    apiKey: apiKey || "ollama",
    baseURL,
    timeout: env.AI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const start = performance.now();

  const params: OpenAI.EmbeddingCreateParams = { model, input: texts };

  if (provider !== "ollama") {
    params.dimensions = EMBEDDING_DIMENSIONS;
  }

  const response = await client.embeddings.create(params);
  const byIndex = new Map(response.data.map((d) => [d.index, d.embedding]));
  const embeddings = texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb) throw new Error(`Embedding response missing index ${i}`);
    if (provider !== "ollama" && emb.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned ${emb.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
    return emb;
  });

  logger.info(
    {
      provider,
      model,
      count: texts.length,
      durationMs: Math.round(performance.now() - start),
    },
    "embedTexts complete",
  );

  return embeddings;
}
