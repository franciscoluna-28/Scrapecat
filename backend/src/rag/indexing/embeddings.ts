import OpenAI from "openai";
import { env } from "@/shared/config/env";
import { resolveApiKey } from "@/api/credentials/services";
import { getAISettings } from "@/api/settings/services";
import { EMBEDDING_DIMENSIONS } from "@/shared/utils";
import {
  getProviderConfig,
  isEmbeddingProviderSupported,
} from "@/shared/integrations/providers/registry";
import { logger } from "@/shared/logger";

export type EmbeddingSpace = {
  provider: string;
  model: string;
};

export type EmbeddingUsage = EmbeddingSpace & {
  /** Input tokens billed by the provider; null when the response omits usage. */
  inputTokens: number | null;
  /** Output tokens billed by the provider; embeddings usually report 0. */
  outputTokens: number | null;
};

export type EmbedTextsResult = {
  embeddings: number[][];
  usage: EmbeddingUsage;
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

function toTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function readUsage(response: {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}): { inputTokens: number | null; outputTokens: number | null } {
  const inputTokens = toTokenCount(
    response.usage?.prompt_tokens ?? response.usage?.total_tokens,
  );
  // Embedding models do not bill output tokens; report an explicit 0 when the
  // provider returned usage but omitted the field.
  const outputTokens =
    toTokenCount(response.usage?.completion_tokens) ??
    (inputTokens === null ? null : 0);
  return { inputTokens, outputTokens };
}

export async function embedTextsWithUsage(
  texts: string[],
  opts?: { model?: string; apiKey?: string; provider?: string },
): Promise<EmbedTextsResult> {
  if (texts.length === 0) {
    return {
      embeddings: [],
      usage: {
        provider: opts?.provider ?? "",
        model: opts?.model ?? "",
        inputTokens: null,
        outputTokens: null,
      },
    };
  }

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

  // Only providers that implement the OpenAI `dimensions` override can be
  // asked to truncate. Others (Ollama) must use a model that natively emits
  // the vector(768) width; the response check below still enforces it.
  if (config.embeddingDimensionsParam) {
    params.dimensions = EMBEDDING_DIMENSIONS;
  }

  const response = await client.embeddings.create(params);
  const byIndex = new Map(response.data.map((d) => [d.index, d.embedding]));
  const embeddings = texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb) throw new Error(`Embedding response missing index ${i}`);
    if (emb.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model "${model}" returned ${emb.length} dims, expected ${EMBEDDING_DIMENSIONS} (commit_embeddings.embedding is vector(${EMBEDDING_DIMENSIONS}))`,
      );
    }
    return emb;
  });

  const { inputTokens, outputTokens } = readUsage(response);

  logger.info(
    {
      provider,
      model,
      count: texts.length,
      inputTokens,
      outputTokens,
      durationMs: Math.round(performance.now() - start),
    },
    "embedTexts complete",
  );

  return { embeddings, usage: { provider, model, inputTokens, outputTokens } };
}

/** Vectors-only wrapper for callers that do not track usage (retrieval). */
export async function embedTexts(
  texts: string[],
  opts?: { model?: string; apiKey?: string; provider?: string },
): Promise<number[][]> {
  const { embeddings } = await embedTextsWithUsage(texts, opts);
  return embeddings;
}
