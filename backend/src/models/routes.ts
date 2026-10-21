import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import { ModelsQuery } from "@/models/schemas";
import { env } from "@/config/env";

const OPENROUTER_FALLBACK = [
  { id: "google/gemma-4-31b-it", name: "GPT-5.6 Luna", free: false, description: "" },
  { id: "google/gemma-4-31b-it", name: "Google: Gemma 4 31B", free: false, description: "" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", free: true, description: "" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", free: true, description: "" },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", free: true, description: "" },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS-20B", free: true, description: "" },
  { id: "cohere/north-mini-code:free", name: "North Mini Code", free: true, description: "" },
];

const DEEPSEEK_FALLBACK = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", free: false, description: "" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", free: false, description: "" },
  { id: "deepseek-chat", name: "DeepSeek Chat", free: false, description: "" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", free: false, description: "" },
];

const OPENAI_FALLBACK = [
  { id: "gpt-4o", name: "GPT-4o", free: false, description: "" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", free: false, description: "" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", free: false, description: "" },
  { id: "o3-mini", name: "o3-mini", free: false, description: "" },
];

/** Only Go models served on the OpenAI-compatible /chat/completions endpoint.
GPT/Claude/Gemini/Grok/Qwen/Muse use Responses/Anthropic/Google endpoints.
*/
const OPENCODE_GO_CHAT_MODELS: Record<string, string> = {
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "glm-5.2": "GLM 5.2",
  "glm-5.3": "GLM 5.3",
  "glm-5.3-flash": "GLM 5.3 Flash",
  "kimi-k2.7-code": "Kimi K2.7 Code",
  "kimi-k3": "Kimi K3",
  "longcat-2.0": "LongCat 2.0",
  "longcat-2.5-preview-free": "LongCat 2.5 Preview Free",
  "mimo-v2.5": "MiMo-V2.5",
  "mimo-v2.5-pro": "MiMo-V2.5-Pro",
  "mimo-v2.6-flash": "MiMo-V2.6-Flash",
  "mimo-v2.6-pro": "MiMo-V2.6-Pro",
  hy3: "Hy3",
  "hy4-preview": "Hy4 Preview",
  "minimax-m3.1-flash-free": "MiniMax M3.1 Flash Free",
  "step-5-preview": "Step 5 Preview",
  "beam-free": "Beam Free",
};

const OPENCODE_GO_FALLBACK = Object.entries(OPENCODE_GO_CHAT_MODELS).map(
  ([id, name]) => ({ id, name, free: id.endsWith("-free"), description: "" }),
);

const PROVIDER_FALLBACKS: Record<string, typeof DEEPSEEK_FALLBACK> = {
  deepseek: DEEPSEEK_FALLBACK,
  openai: OPENAI_FALLBACK,
};

async function fetchOllamaModels(modality: "chat" | "embeddings"): Promise<Array<{ id: string; name: string; free: boolean; description: string; provider: string }>> {
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

export async function listModels(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider, modality = "chat" } = req.query as Static<typeof ModelsQuery>;

  if (provider === "ollama") {
    const models = await fetchOllamaModels(modality);
    return reply.send({ models });
  }

  if (provider === "opencode-go") {
    if (modality === "embeddings") return reply.send({ models: [] });
    return reply.send({
      models: OPENCODE_GO_FALLBACK.map((m) => ({ ...m, provider: "opencode-go" })),
    });
  }

  if (modality === "embeddings") {
    const models = await fetchOpenRouterEmbeddingModels();
    return reply.send({ models });
  }

  if (provider && provider !== "openrouter") {
    const list = PROVIDER_FALLBACKS[provider];
    if (!list) return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    return reply.send({ models: list.map((m) => ({ ...m, provider })) });
  }

  let openrouterModels = OPENROUTER_FALLBACK;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      openrouterModels = (data?.data || [])
        .filter((m: any) => isFree(m.pricing))
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          free: isFree(m.pricing),
          description: m.description || "",
        }));
    }
  } catch {}

  const MVP_DEFAULT = "google/gemma-4-31b-it";
  if (!openrouterModels.some((m) => m.id === MVP_DEFAULT)) {
    openrouterModels = [
      { id: MVP_DEFAULT, name: "Google: Gemma 4 31B", free: false, description: "" },
      ...openrouterModels,
    ];
  }

  if (provider === "openrouter") {
    return reply.send({ models: openrouterModels.map((m) => ({ ...m, provider: "openrouter" })) });
  }

  const all = [
    ...openrouterModels.map((m) => ({ ...m, provider: "openrouter" as const })),
    ...DEEPSEEK_FALLBACK.map((m) => ({ ...m, provider: "deepseek" as const })),
    ...OPENAI_FALLBACK.map((m) => ({ ...m, provider: "openai" as const })),
    ...OPENCODE_GO_FALLBACK.map((m) => ({ ...m, provider: "opencode-go" as const })),
  ];

  return reply.send({ models: all });
}
