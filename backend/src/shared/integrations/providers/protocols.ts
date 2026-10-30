import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/config/env";
import type { ModelDescriptor } from "@/shared/integrations/providers/catalog";
import {
  PROVIDER_USER_AGENT,
  type ProviderConfig,
  type Protocol,
} from "@/shared/integrations/providers/registry";

type CreateLanguageModelParams = {
  provider: string;
  config: ProviderConfig;
  model: ModelDescriptor;
  apiKey: string;
  sessionId?: string;
};

function resolveBaseUrl(
  provider: string,
  config: ProviderConfig,
  protocol: Protocol,
): string {
  if (provider === "ollama") return `${env.OLLAMA_BASE_URL}/v1`;
  return config.protocolBaseUrls?.[protocol] ?? config.baseUrl ?? "";
}

/**
 * Imports provider SDKs. Everything else depends on the
 * provider registry, the model catalog, and this factory's return value.
 */
export function createLanguageModel({
  provider,
  config,
  model,
  apiKey,
  sessionId,
}: CreateLanguageModelParams) {
  const baseURL = resolveBaseUrl(provider, config, model.protocol);
  const headers = {
    "User-Agent": PROVIDER_USER_AGENT,
    ...(config.headers?.({ sessionId }) ?? {}),
  };

  switch (model.protocol) {
    case "openai-chat":
      return createOpenAICompatible({
        name: provider,
        baseURL,
        apiKey,
        headers,
      })(model.id);

    case "openai-responses":
      return createOpenAI({ baseURL, apiKey, headers }).responses(model.id);

    case "anthropic-messages":
      return createAnthropic({ baseURL, apiKey, headers })(model.id);

    case "google-generative":
      return createGoogleGenerativeAI({ baseURL, apiKey, headers })(model.id);
  }
}
