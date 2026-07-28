import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import { env } from "../config/env";
import { getProviderConfig, type ProviderName } from "../providers/registry";

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
}

export interface AIResponse {
  content: string;
}

async function callOpenRouter(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  temperature: number,
  maxTokens: number,
): Promise<AIResponse> {
  const openRouter = new OpenRouter({ apiKey });
  const result = await openRouter.chat.send({
    chatRequest: { model, messages, temperature, maxTokens },
  });

  const rawContent =
    (typeof (result as any).choices?.[0]?.message?.content === "string"
      ? (result as any).choices[0].message.content
      : "") || "";

  return { content: rawContent };
}

async function callOpenAICompatible(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  baseUrl: string,
  temperature: number,
  maxTokens: number,
): Promise<AIResponse> {
  const client = new OpenAI({ apiKey, baseURL: baseUrl });

  const result = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return { content: result.choices?.[0]?.message?.content ?? "" };
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
  const maxTokens = request.maxTokens ?? 1024;

  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  if (config.sdk === "openrouter") {
    return callOpenRouter(request.messages, model, apiKey, temperature, maxTokens);
  }

  if (config.sdk === "openai-compatible") {
    return callOpenAICompatible(
      request.messages,
      model,
      apiKey,
      config.baseUrl,
      temperature,
      maxTokens,
    );
  }

  throw new Error(`Unknown SDK type for provider: ${provider}`);
}

export function cleanResponse(rawContent: string): string {
  return rawContent
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/^-\s*\n(?=[^\s-])/gm, "- ")
    .trim();
}
