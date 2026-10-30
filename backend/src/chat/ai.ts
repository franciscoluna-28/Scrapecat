import { generateText, streamText } from "ai";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { resolveApiKey } from "@/credentials/services";
import { getAISettings } from "@/settings/services";
import {
  resolveModel,
  type ModelDescriptor,
} from "@/shared/integrations/providers/catalog";
import { createLanguageModel } from "@/shared/integrations/providers/protocols";
import {
  getProviderConfig,
  type ProviderConfig,
} from "@/shared/integrations/providers/registry";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * A chat model resolved to everything the client needs to run one request.
 * Resolution (settings, provider metadata, credentials) is separate from
 * execution so `createAIClient` never touches the DB or env keys.
 */
export interface ResolvedChatModel {
  provider: string;
  config: ProviderConfig;
  model: ModelDescriptor;
  apiKey: string;
}

export interface AIRequest {
  model: ResolvedChatModel;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  abortSignal?: AbortSignal;
}

export interface AIResponse {
  content: string;
  finishReason?: string | null;
}

export const DEFAULT_MAX_OUTPUT_TOKENS = env.AI_MAX_OUTPUT_TOKENS;

export class ProviderKeyError extends Error {
  readonly status = 400;

  constructor(provider: string) {
    const envKey =
      getProviderConfig(provider)?.envKey ?? "the provider's env key";
    super(
      `No API key configured for AI provider "${provider}". Add one in Settings or set ${envKey}.`,
    );
  }
}

/**
 * Resolves the chat provider, model, and key for a turn.
 *
 * Precedence: explicit override → stored `app_settings` → env defaults.
 * `resolveApiKey` already falls back to the provider env var, so this is the
 * single key-resolution path (no duplicate env checks downstream).
 */
export async function resolveChatModel(override?: {
  provider?: string;
  model?: string;
}): Promise<ResolvedChatModel> {
  const settings = await getAISettings();
  const provider = override?.provider || settings.chatProvider;
  const config = getProviderConfig(provider);
  if (!config) throw new ProviderKeyError(provider);

  const apiKey =
    (await resolveApiKey(provider)) || (provider === "ollama" ? "ollama" : "");
  if (!apiKey) throw new ProviderKeyError(provider);

  return {
    provider,
    config,
    model: resolveModel(
      provider,
      override?.model || settings.chatModel,
      config.defaultProtocol,
    ),
    apiKey,
  };
}

export type AIClientDeps = {
  generateText: typeof generateText;
  streamText: typeof streamText;
  createLanguageModel: typeof createLanguageModel;
  timeoutMs: number;
  logger: Pick<typeof logger, "error">;
};

const defaultDeps: AIClientDeps = {
  generateText,
  streamText,
  createLanguageModel,
  timeoutMs: env.AI_TIMEOUT_MS,
  logger,
};

export function createAIClient(overrides: Partial<AIClientDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  function buildSettings(request: AIRequest) {
    const { system, conversation } = splitMessages(request.messages);
    const languageModel = deps.createLanguageModel({
      provider: request.model.provider,
      config: request.model.config,
      model: request.model.model,
      apiKey: request.model.apiKey,
      sessionId: request.sessionId,
    });

    return {
      model: languageModel,
      messages: conversation,
      temperature: request.temperature ?? 0.1,
      maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      abortSignal: request.abortSignal,
      timeout: { totalMs: deps.timeoutMs },
      ...(system ? { system } : {}),
    };
  }

  async function run<T>(
    request: AIRequest,
    execute: (settings: ReturnType<typeof buildSettings>) => Promise<T>,
  ): Promise<T> {
    try {
      return await execute(buildSettings(request));
    } catch (error) {
      deps.logger.error(
        {
          provider: request.model.provider,
          model: request.model.model.id,
          providerRequestId: providerRequestId(error),
          err: (error as Error)?.message ?? String(error),
        },
        "AI request failed",
      );
      throw error;
    }
  }

  return {
    async generate(request: AIRequest): Promise<AIResponse> {
      return run(request, async (settings) => {
        const result = await deps.generateText(settings);
        return { content: result.text, finishReason: result.finishReason };
      });
    },

    async stream(
      request: AIRequest,
      onToken: (chunk: string) => void,
    ): Promise<AIResponse> {
      return run(request, async (settings) => {
        const result = deps.streamText(settings);
        for await (const chunk of result.textStream) onToken(chunk);
        return {
          content: await result.text,
          finishReason: await result.finishReason,
        };
      });
    },
  };
}

export const aiClient = createAIClient();

function splitMessages(messages: AIMessage[]) {
  return {
    system: messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
    conversation: messages.flatMap((message) =>
      message.role === "system"
        ? []
        : [{ role: message.role, content: message.content }],
    ),
  };
}

/**
 * Pulls the provider's own request id off an SDK error so a failed upstream
 * call can be logged with something the provider can trace.
 */
function providerRequestId(error: unknown): string | undefined {
  const e = error as {
    responseHeaders?: Record<string, string | undefined>;
    headers?: Record<string, unknown>;
    request_id?: string;
    response?: { headers?: { get?: (name: string) => string | null } };
  };
  const header =
    e?.responseHeaders?.["x-request-id"] ??
    e?.headers?.["x-request-id"] ??
    e?.headers?.["x-requestid"];
  return (
    (typeof header === "string" ? header : undefined) ??
    e?.request_id ??
    e?.response?.headers?.get?.("x-request-id") ??
    undefined
  );
}
