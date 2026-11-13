import type { ChatCitation } from "@/db/schema";
import {
  resolveChatModel,
  type AIMessage,
  type ResolvedChatModel,
} from "@/rag/answer/ai";
import {
  buildSystemPrompt,
  buildUserMessage,
  resolvePersona,
} from "@/rag/context/prompts";
import { retriever } from "@/rag/retrieval/retrieve";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import type { IngestProgress } from "@/rag/indexing/ingest";

export const HISTORY_LIMIT = 20;

export type TurnHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TurnWindow = {
  startDate?: Date;
  endDate?: Date;
};

export type PrepareBranch = (
  projectId: string,
  branch: string,
  onProgress?: IngestProgress,
) => Promise<{ branch?: string } | null>;

export type TurnInput = {
  projectId: string;
  query: string;
  branch?: string | null;
  provider?: string;
  model?: string;
  persona?: string;
  history?: TurnHistoryMessage[];
  window?: TurnWindow;
  onProgress?: IngestProgress;
  now?: Date;
};

type ProjectRow = Awaited<ReturnType<typeof projectsStore.getProjectById>>;

export type TurnContext = {
  project: ProjectRow;
  branch: string;
  scope: {
    citations: ChatCitation[];
    startDate?: Date;
    endDate?: Date;
  };
  model: ResolvedChatModel;
  messages: AIMessage[];
};

type TurnResolverDeps = {
  projects: Pick<typeof projectsStore, "getProjectById">;
  retriever: Pick<typeof retriever, "resolveScope" | "retrieve">;
  resolveModel: typeof resolveChatModel;
  now: () => Date;
};

const defaultDeps: TurnResolverDeps = {
  projects: projectsStore,
  retriever,
  resolveModel: resolveChatModel,
  now: () => new Date(),
};

/**
 * Chat turn resolution shared by the stateful web chat and the stateless
 * MCP/CLI path. This module owns project/branch/retrieval/model/prompt
 * assembly only: no sessions, no persistence, no Fastify or SSE.
 *
 * Why: multiple clients must not reimplement RAG. See
 * docs/architecture.md -> "Multiple clients (web chat and MCP)".
 */
export function createTurnResolver(overrides: Partial<TurnResolverDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  function toHistory(
    history: TurnHistoryMessage[] | undefined,
  ): AIMessage[] {
    return (history ?? [])
      .slice(-HISTORY_LIMIT)
      .map((message) => ({ role: message.role, content: message.content }));
  }

  function buildMessages(input: {
    project: ProjectRow;
    branch: string;
    scope: TurnContext["scope"];
    query: string;
    persona?: string;
    history?: TurnHistoryMessage[];
    now: Date;
  }): AIMessage[] {
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          input.project?.repositoryName,
          input.now,
          resolvePersona(input.persona),
        ),
      },
      ...toHistory(input.history),
      {
        role: "user",
        content: buildUserMessage(input.query, input.scope.citations, {
          branch: input.branch,
          startDate: input.scope.startDate,
          endDate: input.scope.endDate,
          now: input.now,
        }),
      },
    ];
  }

  async function resolveTurn(
    input: TurnInput,
    prepareBranch?: PrepareBranch,
  ): Promise<TurnContext> {
    const project = await deps.projects.getProjectById(input.projectId);
    const requestedBranch = input.branch || project?.defaultBranch || "main";

    const branch = prepareBranch
      ? (await prepareBranch(
          input.projectId,
          requestedBranch,
          input.onProgress,
        ).catch(() => null))?.branch || requestedBranch
      : requestedBranch;

    const scope = input.window
      ? {
          ...input.window,
          citations: await deps.retriever.retrieve({
            projectId: input.projectId,
            query: input.query,
            branch,
            ...input.window,
          }),
        }
      : await deps.retriever.resolveScope({
          projectId: input.projectId,
          query: input.query,
          branch,
        });

    const model = await deps.resolveModel({
      provider: input.provider,
      model: input.model,
    });

    const now = input.now ?? deps.now();
    const messages = buildMessages({
      project,
      branch,
      scope,
      query: input.query,
      persona: input.persona,
      history: input.history,
      now,
    });

    return { project, branch, scope, model, messages };
  }

  return { resolveTurn };
}

export const turnResolver = createTurnResolver();
