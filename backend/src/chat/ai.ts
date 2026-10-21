import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import {
  getProviderConfig,
  getProviderHeaders,
  PROVIDER_USER_AGENT,
} from "@/shared/integrations/providers/registry";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Pulls the provider's own request id off an SDK error so a failed upstream
 * call can be reported back to the provider (OpenAI exposes `x-request-id`
 * header and `request_id`; OpenRouter mirrors the header).
 */
function providerRequestId(error: unknown): string | undefined {
  const e = error as {
    headers?: Record<string, unknown>;
    request_id?: string;
    response?: { headers?: { get?: (name: string) => string | null } };
  };
  const header = e?.headers?.["x-request-id"] ?? e?.headers?.["x-requestid"];
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
  onChunk?: (chunk: string) => void;
}

export interface AIResponse {
  content: string;
  finishReason?: string | null;
}

async function callOpenRouter(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  temperature: number,
  maxTokens: number,
  onChunk?: (chunk: string) => void,
): Promise<AIResponse> {
  if (onChunk) {
    const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
    return streamChatCompletions(client, { model, messages, temperature, maxTokens }, onChunk);
  }

  const openRouter = new OpenRouter({ apiKey });
  const result = await openRouter.chat.send({
    chatRequest: { model, messages, temperature, maxTokens },
  });

  const rawContent =
    (typeof (result as any).choices?.[0]?.message?.content === "string"
      ? (result as any).choices[0].message.content
      : "") || "";

  return {
    content: rawContent,
    finishReason: (result as any).choices?.[0]?.finish_reason ?? null,
  };
}

async function callOpenAICompatible(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  baseUrl: string,
  temperature: number,
  maxTokens: number,
  headers: Record<string, string>,
  onChunk?: (chunk: string) => void,
): Promise<AIResponse> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    defaultHeaders: { "User-Agent": PROVIDER_USER_AGENT, ...headers },
  });

  if (onChunk) {
    return streamChatCompletions(client, { model, messages, temperature, maxTokens }, onChunk);
  }

  const result = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return {
    content: result.choices?.[0]?.message?.content ?? "",
    finishReason: result.choices?.[0]?.finish_reason ?? null,
  };
}

async function streamChatCompletions(
  client: OpenAI,
  params: {
    model: string;
    messages: AIMessage[];
    temperature: number;
    maxTokens: number;
  },
  onChunk: (chunk: string) => void,
): Promise<AIResponse> {
  let content = "";
  let finishReason: string | null | undefined;

  const stream = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    stream: true,
  });

  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) {
      content += delta;
      onChunk(delta);
    }
    const reason = part.choices?.[0]?.finish_reason;
    if (reason) finishReason = reason;
  }

  return { content, finishReason: finishReason ?? null };
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const provider = request.provider || "openrouter";
  const config = getProviderConfig(provider);

  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const apiKey = request.apiKey || (env as unknown as Record<string, string>)[config.envKey] || "";
  const model = request.model || config.defaultModel;
  const temperature = request.temperature ?? 0.1;
  const maxTokens = request.maxTokens ?? 4096;

  if (!apiKey && provider !== "ollama") {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  try {
    if (config.sdk === "openrouter") {
      return await callOpenRouter(request.messages, model, apiKey, temperature, maxTokens, request.onChunk);
    }

    if (config.sdk === "openai-compatible") {
      const baseUrl =
        provider === "ollama" ? `${env.OLLAMA_BASE_URL}/v1` : config.baseUrl;
      return await callOpenAICompatible(
        request.messages,
        model,
        apiKey || "ollama",
        baseUrl,
        temperature,
        maxTokens,
        getProviderHeaders(provider, request.sessionId),
        request.onChunk,
      );
    }

    throw new Error(`Unknown SDK type for provider: ${provider}`);
  } catch (error) {
    const upstreamId = providerRequestId(error);
    logger.error(
      {
        provider,
        model,
        providerRequestId: upstreamId,
        err: (error as Error)?.message ?? String(error),
      },
      "callAI failed",
    );
    if (upstreamId && error instanceof Error) {
      (error as Error & { providerRequestId?: string }).providerRequestId = upstreamId;
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
    const envKey = getProviderConfig(provider)?.envKey ?? "the provider's env key";
    super(
      `No API key configured for AI provider "${provider}". Add one in Settings or set ${envKey}.`,
    );
  }
}
