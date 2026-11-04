import type { ChatCitation } from "@/db/schema";
import { aiClient } from "@/chat/ai";
import { resolvePersona, type Persona } from "@/chat/prompts";
import { turnResolver, type TurnInput } from "@/chat/turn";

export type AnswerInput = TurnInput & {
  signal?: AbortSignal;
};

export type AnswerResult = {
  content: string;
  citations: ChatCitation[];
  branch: string;
  persona: Persona;
  startDate?: Date;
  endDate?: Date;
};

type AnswerDeps = {
  resolveTurn: typeof turnResolver.resolveTurn;
  ai: Pick<typeof aiClient, "generate">;
};

const defaultDeps: AnswerDeps = {
  resolveTurn: turnResolver.resolveTurn,
  ai: aiClient,
};

/**
 * Stateless one-shot answer path for clients that own their own conversation
 * (MCP server, CLI). It reuses the same turn resolution as the web chat but
 * never creates a chat session or persists messages.
 *
 * See docs/architecture.md -> "Multiple clients (web chat and MCP)".
 */
export function createAnswerService(overrides: Partial<AnswerDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  async function answerQuestion(input: AnswerInput): Promise<AnswerResult> {
    const turn = await deps.resolveTurn(input);
    const result = await deps.ai.generate({
      model: turn.model,
      messages: turn.messages,
      abortSignal: input.signal,
    });

    return {
      content: result.content,
      citations: turn.scope.citations,
      branch: turn.branch,
      persona: resolvePersona(input.persona),
      startDate: turn.scope.startDate,
      endDate: turn.scope.endDate,
    };
  }

  return { answerQuestion };
}

export const answerService = createAnswerService();
