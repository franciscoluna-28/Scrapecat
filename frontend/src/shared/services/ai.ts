import { OpenRouter } from "@openrouter/sdk";

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

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const openRouter = new OpenRouter({ apiKey });

  const model = request.model || process.env.AI_MODEL || DEFAULT_MODEL;

  const result = await openRouter.chat.send({
    chatRequest: {
      model,
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
