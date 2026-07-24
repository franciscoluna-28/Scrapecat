import { OpenRouter } from "@openrouter/sdk";
import { env } from "../config/env";

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const openRouter = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });

  const result = await openRouter.chat.send({
    chatRequest: {
      model: request.model || env.AI_MODEL || DEFAULT_MODEL,
      messages: request.messages,
      temperature: request.temperature ?? 0.1,
      maxTokens: request.maxTokens ?? 1024,
    },
  });

  const rawContent =
    (typeof (result as any).choices?.[0]?.message?.content === "string"
      ? (result as any).choices[0].message.content
      : "") || "";

  return { content: rawContent };
}

export function cleanResponse(rawContent: string): string {
  return rawContent
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/^-\s*\n(?=[^\s-])/gm, "- ")
    .trim();
}
