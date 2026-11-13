import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import { ModelsQuery } from "@/api/settings/schemas";
import { env } from "@/shared/config/env";
import {
  EMBEDDING_MODEL_ALLOWLIST,
  getCatalogModels,
  type ModelDescriptor,
} from "@/shared/integrations/providers/catalog";
import {
  PROVIDER_REGISTRY,
  isProviderSupported,
  type ProviderName,
} from "@/shared/integrations/providers/registry";

const OLLAMA_TIMEOUT_MS = 1500;
const EMBEDDING_MODEL_NAME = /(embed|bge|minilm|mxbai|nomic|e5|gte)/i;

function isOllamaModel(
  model: any,
  modality: "chat" | "embeddings",
): boolean {
  const capabilities = Array.isArray(model.capabilities)
    ? (model.capabilities as string[])
    : null;
  if (capabilities) {
    return capabilities.includes(
      modality === "embeddings" ? "embedding" : "completion",
    );
  }

  // `/api/tags` does not return capabilities. Classify by name: embedding
  // models are easy to recognize, everything else is treated as chat.
  const name = String(model.name ?? model.model ?? "");
  const isEmbedding = EMBEDDING_MODEL_NAME.test(name);
  return modality === "embeddings" ? isEmbedding : !isEmbedding;
}

async function fetchOllamaModels(
  modality: "chat" | "embeddings",
): Promise<Array<{ id: string; name: string; free: boolean; description: string; provider: string }>> {
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return models
      .filter((m: any) => isOllamaModel(m, modality))
      .map((m: any) => {
        const id = String(m.name ?? m.model ?? "").replace(/:latest$/, "");
        return {
          id,
          name: id,
          free: true,
          description: `${m.details?.parameter_size || ""} · ${m.details?.quantization_level || ""}`.trim(),
          provider: "ollama",
        };
      })
      .filter((m: { id: string }) => m.id.length > 0);
  } catch {
    return [];
  }
}

function isFree(pricing: any): boolean {
  return !pricing || (pricing?.prompt == 0 && pricing?.completion == 0);
}

async function fetchOpenRouterEmbeddingModels() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models?output_modalities=embeddings", {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data || [])
      .filter((m: any) => EMBEDDING_MODEL_ALLOWLIST.has(m.id))
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        free: isFree(m.pricing),
        description: m.description || "",
        provider: "openrouter",
      }));
  } catch {
    return [];
  }
}

async function fetchOpenRouterModels(): Promise<ModelDescriptor[]> {
  const fallback = getCatalogModels("openrouter");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const models: ModelDescriptor[] = (data?.data || [])
      .filter((m: any) => isFree(m.pricing))
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        protocol: "openai-chat",
        free: isFree(m.pricing),
        description: m.description || "",
      }));
    const MVP_DEFAULT = "google/gemma-4-31b-it";
    if (!models.some((m) => m.id === MVP_DEFAULT)) {
      models.unshift({
        id: MVP_DEFAULT,
        name: "Google: Gemma 4 31B",
        protocol: "openai-chat",
        free: false,
        description: "",
      });
    }
    return models;
  } catch {
    return fallback;
  }
}

function toApiModel(model: ModelDescriptor, provider: string) {
  return {
    id: model.id,
    name: model.name,
    free: model.free,
    description: model.description,
    provider,
  };
}

export async function listModels(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider, modality = "chat" } = req.query as Static<typeof ModelsQuery>;

  if (provider && !isProviderSupported(provider)) {
    return reply.status(400).send({ error: `Unknown provider: ${provider}` });
  }

  if (provider === "ollama") {
    const models = await fetchOllamaModels(modality);
    return reply.send({ models });
  }

  if (modality === "embeddings") {
    if (provider && provider !== "openrouter") {
      return reply.send({ models: [] });
    }
    const models = await fetchOpenRouterEmbeddingModels();
    return reply.send({ models });
  }

  if (provider && provider !== "openrouter") {
    return reply.send({
      models: getCatalogModels(provider).map((model) => toApiModel(model, provider)),
    });
  }

  if (provider === "openrouter") {
    const models = await fetchOpenRouterModels();
    return reply.send({
      models: models.map((model) => toApiModel(model, "openrouter")),
    });
  }

  const catalogProviders = (
    Object.keys(PROVIDER_REGISTRY) as ProviderName[]
  ).filter((provider) => provider !== "openrouter" && provider !== "ollama");

  const [openRouterModels, ollamaModels] = await Promise.all([
    fetchOpenRouterModels(),
    fetchOllamaModels("chat"),
  ]);

  const all = [
    ...openRouterModels.map((model) => toApiModel(model, "openrouter")),
    ...ollamaModels,
    ...catalogProviders.flatMap((provider) =>
      getCatalogModels(provider).map((model) => toApiModel(model, provider)),
    ),
  ];

  return reply.send({ models: all });
}
