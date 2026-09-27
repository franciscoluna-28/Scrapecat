import OpenAI from "openai";
import { env } from "@/config/env";
import { resolveApiKey } from "@/credentials/services";
import { getAISettings } from "@/settings/services";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { logger } from "@/shared/logger";

const EMBEDDING_DIMENSIONS = 768;

export async function embedTexts(
  texts: string[],
  opts?: { model?: string; apiKey?: string; provider?: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const settings = await getAISettings();
  const provider = opts?.provider || settings.embeddingProvider;
  const model = opts?.model || settings.embeddingModel;
  const config = getProviderConfig(provider);

  if (!config) {
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

  const client = new OpenAI({ apiKey: apiKey || "ollama", baseURL });
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
