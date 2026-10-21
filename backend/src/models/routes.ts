import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import { ModelsQuery } from "@/models/schemas";
import { env } from "@/config/env";
import {
  getCatalogModels,
  type ModelDescriptor,
} from "@/shared/integrations/providers/catalog";
import { isProviderSupported } from "@/shared/integrations/providers/registry";

async function fetchOllamaModels(
  modality: "chat" | "embeddings",
): Promise<Array<{ id: string; name: string; free: boolean; description: string; provider: string }>> {
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    const models = data?.models || [];
    return models
      .filter((m: any) => {
        if (modality === "embeddings") return m.capabilities?.includes("embedding");
        return m.capabilities?.includes("completion");
      })
      .map((m: any) => ({
        id: m.name.replace(/:latest$/, ""),
        name: m.name.replace(/:latest$/, ""),
        free: true,
        description: `${m.details?.parameter_size || ""} · ${m.details?.quantization_level || ""}`.trim(),
        provider: "ollama",
      }));
  } catch {
    return [];
  }
}

function isFree(pricing: any): boolean {
  return !pricing || (pricing?.prompt == 0 && pricing?.completion == 0);
}

// MVP embedding models constrained to the vector(768) column.
const EMBEDDING_MODEL_ALLOWLIST = new Set([
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
]);

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

  const openRouterModels = await fetchOpenRouterModels();
  if (provider === "openrouter") {
    return reply.send({
      models: openRouterModels.map((model) => toApiModel(model, "openrouter")),
    });
  }

  const all = [
    ...openRouterModels.map((model) => toApiModel(model, "openrouter")),
    ...getCatalogModels("deepseek").map((model) => toApiModel(model, "deepseek")),
    ...getCatalogModels("openai").map((model) => toApiModel(model, "openai")),
    ...getCatalogModels("opencode-go").map((model) => toApiModel(model, "opencode-go")),
  ];

  return reply.send({ models: all });
}
