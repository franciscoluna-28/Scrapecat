export const PROVIDER_REGISTRY = {
  openrouter: {
    sdk: "openrouter",
    defaultModel: "openai/gpt-5.6-luna",
    envKey: "OPENROUTER_API_KEY",
    verifyUrl: "https://openrouter.ai/api/v1/auth/key",
  },
  deepseek: {
    sdk: "openai-compatible",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    verifyUrl: "https://api.deepseek.com/v1/models",
  },
  openai: {
    sdk: "openai-compatible",
    defaultModel: "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    verifyUrl: "https://api.openai.com/v1/models",
  },
  "opencode-go": {
    sdk: "openai-compatible",
    defaultModel: "deepseek-v4.1-flash",
    baseUrl: "https://opencode.ai/inference/go/openai/v1",
    envKey: "OPENCODE_GO_API_KEY",
    verifyUrl: "https://opencode.ai/inference/go/v1/usage",
  },
  ollama: {
    sdk: "openai-compatible",
    defaultModel: "llama3.2:1b",
    baseUrl: "",
    envKey: "OLLAMA_API_KEY",
    verifyUrl: "",
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_REGISTRY;
export type ProviderConfig = (typeof PROVIDER_REGISTRY)[ProviderName];

export const PROVIDER_USER_AGENT = "scrapecat/0.1.0";

/** Provider-specific headers that are not part of the OpenAI-compatible API. */
export function getProviderHeaders(
  provider: string,
  sessionId?: string,
): Record<string, string> {
  if (provider === "opencode-go" && sessionId) {
    return { "x-opencode-session": sessionId };
  }
  return {};
}

export function getProviderConfig(provider: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[provider as ProviderName];
}

export function isProviderSupported(provider: string): provider is ProviderName {
  return provider in PROVIDER_REGISTRY;
}
