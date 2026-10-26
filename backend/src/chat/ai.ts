import { generateText, streamText } from "ai";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { resolveModel } from "@/shared/integrations/providers/catalog";
import { createLanguageModel } from "@/shared/integrations/providers/protocols";
import { getProviderConfig } from "@/shared/integrations/providers/registry";

/**
 * Pulls the provider's own request id off an SDK error so a failed upstream
 * call can be reported back to the provider.
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

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  provider?: string;
  sessionId?: string;
  stream?: boolean;
  abortSignal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

export interface AIResponse {
  content: string;
  finishReason?: string | null;
}

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

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const provider = request.provider || "openrouter";
  const config = getProviderConfig(provider);

  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const apiKey =
    request.apiKey ||
    env[config.envKey] ||
    (provider === "ollama" ? "ollama" : "");
  const model = resolveModel(
    provider,
    request.model || config.defaultModel,
    config.defaultProtocol,
  );
  const temperature = request.temperature ?? 0.1;
  const maxTokens = request.maxTokens ?? 4096;

  if (!apiKey && provider !== "ollama") {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const { system, conversation } = splitMessages(request.messages);
  const languageModel = createLanguageModel({
    provider,
    config,
    model,
    apiKey,
    sessionId: request.sessionId,
  });
  const settings = {
    model: languageModel,
    messages: conversation,
    temperature,
    maxOutputTokens: maxTokens,
    abortSignal: request.abortSignal,
    timeout: { totalMs: env.AI_TIMEOUT_MS },
    ...(system ? { system } : {}),
  };

  try {
    if (request.onChunk) {
      const result = streamText(settings);
      for await (const chunk of result.textStream) {
        request.onChunk(chunk);
      }
      return {
        content: await result.text,
        finishReason: await result.finishReason,
      };
    }

    const result = await generateText(settings);
    return { content: result.text, finishReason: result.finishReason };
  } catch (error) {
    const upstreamId = providerRequestId(error);
    logger.error(
      {
        provider,
        model: model.id,
        providerRequestId: upstreamId,
        err: (error as Error)?.message ?? String(error),
      },
      "callAI failed",
    );
    if (upstreamId && error instanceof Error) {
      (error as Error & { providerRequestId?: string }).providerRequestId =
        upstreamId;
    }
    throw error;
  }
}

export function cleanResponse(rawContent: string): string {
  const withoutThinking = rawContent
    .replace(/<thinking[^>]*>[\s\S]*?<\/thinking\s*>/gi, "")
    .replace(/^-\s*\n+(?=[^\s-])/gm, "- ")
    .trim();

  const titleMatch = withoutThinking.search(/^#\s+Product Update/m);
  const anchor =
    titleMatch >= 0 ? titleMatch : withoutThinking.search(/^# .+/m);

  if (anchor > 0) {
    return withoutThinking.slice(anchor).trim();
  }
  return withoutThinking;
}

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
