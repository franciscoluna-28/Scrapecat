import type { env } from "@/config/env";

export type Protocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative";

/** String-valued env keys, so provider config can index `env` without casts. */
type EnvKey = {
  [K in keyof typeof env]: (typeof env)[K] extends string ? K : never;
}[keyof typeof env];

export type ProviderConfig = {
  label: string;
  defaultModel: string;
  defaultProtocol: Protocol;
  envKey: EnvKey;
  verifyUrl: string;
  baseUrl?: string;
  protocolBaseUrls?: Partial<Record<Protocol, string>>;
  headers?: (context: { sessionId?: string }) => Record<string, string>;
};

export const PROVIDER_REGISTRY = {
  openrouter: {
    label: "OpenRouter",
    defaultModel: "deepseek/deepseek-v4.1-flash",
    defaultProtocol: "openai-chat",
    envKey: "OPENROUTER_API_KEY",
    verifyUrl: "https://openrouter.ai/api/v1/auth/key",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    defaultProtocol: "openai-chat",
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    verifyUrl: "https://api.deepseek.com/v1/models",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o",
    defaultProtocol: "openai-chat",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    verifyUrl: "https://api.openai.com/v1/models",
  },
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    defaultProtocol: "openai-chat",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    verifyUrl: "https://api.groq.com/openai/v1/models",
  },
  "opencode-go": {
    label: "OpenCode Go",
    defaultModel: "deepseek-v4.1-flash",
    defaultProtocol: "openai-chat",
    baseUrl: "https://opencode.ai/inference/go/openai/v1",
    protocolBaseUrls: {
      "openai-chat": "https://opencode.ai/inference/go/openai/v1",
      "openai-responses": "https://opencode.ai/inference/go/openai/v1",
      "anthropic-messages": "https://opencode.ai/inference/go/anthropic",
      "google-generative": "https://opencode.ai/inference/go/google/v1beta",
    },
    envKey: "OPENCODE_GO_API_KEY",
    verifyUrl: "https://opencode.ai/inference/go/v1/usage",
    headers: ({ sessionId }) => {
      if (!sessionId) {
        throw new Error("Session ID is required for OpenCode Go requests.");
      }
      return {
        "x-opencode-session": sessionId,
      };
    },
  },
  ollama: {
    label: "Ollama",
    defaultModel: "llama3.2:1b",
    defaultProtocol: "openai-chat",
    envKey: "OLLAMA_API_KEY",
    verifyUrl: "",
  },
} as const satisfies Record<string, ProviderConfig>;

export type ProviderName = keyof typeof PROVIDER_REGISTRY;

export const EMBEDDING_PROVIDER_NAMES = [
  "openrouter",
  "ollama",
] as const satisfies readonly ProviderName[];

export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDER_NAMES)[number];

export const PROVIDER_USER_AGENT = "scrapecat/0.1.0";

export function getProviderConfig(provider: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[provider as ProviderName];
}

export function isProviderSupported(provider: string): provider is ProviderName {
  return provider in PROVIDER_REGISTRY;
}

export function isEmbeddingProviderSupported(
  provider: string,
): provider is EmbeddingProviderName {
  return (EMBEDDING_PROVIDER_NAMES as readonly string[]).includes(provider);
}
