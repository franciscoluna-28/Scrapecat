import type { Protocol } from "@/shared/integrations/providers/registry";

export type ModelDescriptor = {
  id: string;
  name: string;
  protocol: Protocol;
  free: boolean;
  description: string;
};

function openRouterModel(
  id: string,
  name: string,
  free = false,
): ModelDescriptor {
  return { id, name, protocol: "openai-chat", free, description: "" };
}

function openCodeGoModel(
  id: string,
  name: string,
  protocol: Protocol,
): ModelDescriptor {
  return { id, name, protocol, free: id.endsWith("-free"), description: "" };
}

const OPENROUTER_CATALOG: ModelDescriptor[] = [
  openRouterModel("deepseek/deepseek-v4.1-flash", "DeepSeek V4.1 Flash"),
  openRouterModel("google/gemma-4-31b-it", "GPT-5.6 Luna"),
  openRouterModel("google/gemma-4-31b-it", "Google: Gemma 4 31B"),
  openRouterModel("nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra", true),
  openRouterModel("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super", true),
  openRouterModel("inclusionai/ling-3.0-flash:free", "Ling 3.0 Flash", true),
  openRouterModel("openai/gpt-oss-20b:free", "GPT-OSS-20B", true),
  openRouterModel("cohere/north-mini-code:free", "North Mini Code", true),
];

const DEEPSEEK_CATALOG: ModelDescriptor[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", protocol: "openai-chat", free: false, description: "" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", protocol: "openai-chat", free: false, description: "" },
  { id: "deepseek-chat", name: "DeepSeek Chat", protocol: "openai-chat", free: false, description: "" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", protocol: "openai-chat", free: false, description: "" },
];

const OPENAI_CATALOG: ModelDescriptor[] = [
  { id: "gpt-4o", name: "GPT-4o", protocol: "openai-chat", free: false, description: "" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", protocol: "openai-chat", free: false, description: "" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", protocol: "openai-chat", free: false, description: "" },
  { id: "o3-mini", name: "o3-mini", protocol: "openai-chat", free: false, description: "" },
];

const GROQ_CATALOG: ModelDescriptor[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", protocol: "openai-chat", free: false, description: "" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", protocol: "openai-chat", free: false, description: "" },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B", protocol: "openai-chat", free: false, description: "" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", protocol: "openai-chat", free: false, description: "" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", protocol: "openai-chat", free: false, description: "" },
];

// Only the models documented on OpenCode Go's /chat/completions, /responses,
// /anthropic, and /google endpoints. Gemini Argon and Muse Spark are excluded
// because they train on prompts.
const OPENCODE_GO_CATALOG: ModelDescriptor[] = [
  // OpenAI Responses
  openCodeGoModel("grok-4.7", "Grok 4.7", "openai-responses"),
  openCodeGoModel("gpt-6-luna", "GPT 6 Luna", "openai-responses"),
  openCodeGoModel("gpt-5.6-luna", "GPT 5.6 Luna", "openai-responses"),

  // Anthropic Messages
  openCodeGoModel("claude-haiku-5-5", "Claude Haiku 5.5", "anthropic-messages"),
  openCodeGoModel("minimax-m3", "MiniMax M3", "anthropic-messages"),
  openCodeGoModel("qwen3.8-max", "Qwen3.8 Max", "anthropic-messages"),
  openCodeGoModel("qwen3.8-flash", "Qwen3.8 Flash", "anthropic-messages"),
  openCodeGoModel("qwen3.7-plus", "Qwen3.7 Plus", "anthropic-messages"),

  // OpenAI chat completions
  openCodeGoModel("glm-5.3-flash", "GLM 5.3 Flash", "openai-chat"),
  openCodeGoModel("glm-5.3", "GLM 5.3", "openai-chat"),
  openCodeGoModel("glm-5.2", "GLM 5.2", "openai-chat"),
  openCodeGoModel("kimi-k3", "Kimi K3", "openai-chat"),
  openCodeGoModel("kimi-k2.7-code", "Kimi K2.7 Code", "openai-chat"),
  openCodeGoModel("longcat-2.0", "LongCat 2.0", "openai-chat"),
  openCodeGoModel("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", "openai-chat"),
  openCodeGoModel("deepseek-v4-pro", "DeepSeek V4 Pro", "openai-chat"),
  openCodeGoModel("mimo-v2.6-flash", "MiMo-V2.6-Flash", "openai-chat"),
  openCodeGoModel("mimo-v2.6-pro", "MiMo-V2.6-Pro", "openai-chat"),
  openCodeGoModel("mimo-v2.5", "MiMo-V2.5", "openai-chat"),
  openCodeGoModel("mimo-v2.5-pro", "MiMo-V2.5-Pro", "openai-chat"),
  openCodeGoModel("hy4-preview", "Hy4 Preview", "openai-chat"),
  openCodeGoModel("hy3", "Hy3", "openai-chat"),
  openCodeGoModel("minimax-m3.1-flash-free", "MiniMax M3.1 Flash Free", "openai-chat"),
  openCodeGoModel("longcat-2.5-preview-free", "LongCat 2.5 Preview Free", "openai-chat"),
  openCodeGoModel("step-5-preview", "Step 5 Preview", "openai-chat"),
  openCodeGoModel("beam-free", "Beam Free", "openai-chat"),
];

export const MODEL_CATALOG: Record<string, ModelDescriptor[]> = {
  openrouter: OPENROUTER_CATALOG,
  deepseek: DEEPSEEK_CATALOG,
  openai: OPENAI_CATALOG,
  groq: GROQ_CATALOG,
  "opencode-go": OPENCODE_GO_CATALOG,
  ollama: [],
};

export function getCatalogModels(provider: string): ModelDescriptor[] {
  return MODEL_CATALOG[provider] ?? [];
}

/**
 * Returns the provider whose catalog owns a model id, or undefined for ids we
 * do not know about (e.g. models fetched live from OpenRouter).
 */
export function findProviderForModel(modelId: string): string | undefined {
  return Object.entries(MODEL_CATALOG).find(([, models]) =>
    models.some((model) => model.id === modelId),
  )?.[0];
}

export function resolveModel(
  provider: string,
  modelId: string,
  defaultProtocol: Protocol,
): ModelDescriptor {
  const match = getCatalogModels(provider).find((model) => model.id === modelId);
  return (
    match ?? {
      id: modelId,
      name: modelId,
      protocol: defaultProtocol,
      free: false,
      description: "",
    }
  );
}
