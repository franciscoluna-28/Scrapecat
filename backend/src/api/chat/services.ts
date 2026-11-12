import type { ChatCitation } from "@/db/schema";
import { aiClient, resolveChatModel } from "@/rag/answer/ai";
import {
  chatStore,
  type ChatMessageRow,
  type ChatSessionRow,
} from "@/api/chat/chat-store";
import { retriever } from "@/rag/retrieval/retrieve";
import { createTurnResolver, type TurnHistoryMessage } from "@/rag/answer/turn";
import type { ChatMessageDTO } from "@/api/chat/schemas";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import { prepareProjectBranch } from "@/api/repositories/services";
import type { IngestProgress } from "@/rag/indexing/ingest";

export type ChatStreamOptions = {
  sessionId: string;
  content: string;
  branch?: string | null;
  model?: string;
  provider?: string;
  persona?: string;
  clientMessageId?: string;
  signal?: AbortSignal;
  onToken: (chunk: string) => void;
  onProgress?: IngestProgress;
};

type ChatServiceDeps = {
  store: typeof chatStore;
  projects: typeof projectsStore;
  ai: typeof aiClient;
  resolveModel: typeof resolveChatModel;
  retriever: typeof retriever;
  prepareBranch: typeof prepareProjectBranch;
};

const defaultDeps: ChatServiceDeps = {
  store: chatStore,
  projects: projectsStore,
  ai: aiClient,
  resolveModel: resolveChatModel,
  retriever,
  prepareBranch: prepareProjectBranch,
};

function toHistory(rows: ChatMessageRow[]): TurnHistoryMessage[] {
  return rows.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  }));
}

/**
 * Web chat application service: session operations plus the streamed-turn
 * pipeline. Turn resolution (project/branch/retrieval/model/prompts) lives in
 * `chat/turn.ts` so the MCP/CLI path can share it without sessions or
 * persistence. Dependencies are injected so tests can swap the store, project
 * lookup, retrieval, model resolution, and AI client.
 */
export function createChatService(overrides: Partial<ChatServiceDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const turnResolver = createTurnResolver({
    projects: deps.projects,
    retriever: deps.retriever,
    resolveModel: deps.resolveModel,
  });

  function toMessageDTO(row: ChatMessageRow): ChatMessageDTO {
    return {
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      branch: row.branch ?? null,
      citations: (row.citations ?? []) as ChatCitation[],
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  function toSessionDTO(row: ChatSessionRow) {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async function requireSession(sessionId: string) {
    const session = await deps.store.getSession(sessionId);
    if (!session) throw new SessionNotFoundError();
    return session;
  }

  async function prepareTurn(options: ChatStreamOptions) {
    const session = await requireSession(options.sessionId);
    // Drop a leftover row from a failed attempt with the same client id so a
    // retry doesn't feed the same question into the prompt twice.
    const history = (await deps.store.listMessages(options.sessionId)).filter(
      (message) =>
        !options.clientMessageId ||
        message.clientMessageId !== options.clientMessageId,
    );

    await deps.store.addMessage({
      sessionId: options.sessionId,
      role: "user",
      content: options.content,
      ...(options.clientMessageId
        ? { clientMessageId: options.clientMessageId }
        : {}),
    });

    const turn = await turnResolver.resolveTurn(
      {
        projectId: session.projectId,
        query: options.content,
        branch: options.branch,
        provider: options.provider,
        model: options.model,
        persona: options.persona,
        history: toHistory(history),
        onProgress: options.onProgress,
      },
      deps.prepareBranch,
    );

    return { session, ...turn };
  }

  async function streamMessage(
    options: ChatStreamOptions,
  ): Promise<ChatMessageDTO> {
    // A retried send reuses the client-generated id, so a completed turn can be
    // replayed without calling the model again.
    if (options.clientMessageId) {
      const existing = await deps.store.findMessageByClientId(
        options.sessionId,
        "assistant",
        options.clientMessageId,
      );
      if (existing) return toMessageDTO(existing);
    }

    const turn = await prepareTurn(options);

    const result = await deps.ai.stream(
      {
        model: turn.model,
        messages: turn.messages,
        sessionId: options.sessionId,
        abortSignal: options.signal,
      },
      options.onToken,
    );

    let reply = await deps.store.addMessage({
      sessionId: options.sessionId,
      role: "assistant",
      content: result.content,
      branch: turn.branch,
      citations: turn.scope.citations,
      ...(options.clientMessageId
        ? { clientMessageId: options.clientMessageId }
        : {}),
    });

    // Lost a race with a concurrent retry; reuse the stored turn.
    if (!reply && options.clientMessageId) {
      reply = await deps.store.findMessageByClientId(
        options.sessionId,
        "assistant",
        options.clientMessageId,
      );
    }
    if (!reply) {
      throw new Error("Failed to persist assistant message");
    }

    await deps.store.touchSession(options.sessionId);

    return toMessageDTO(reply);
  }

  async function createSession(projectId: string, anonymousId: string) {
    const project = await deps.projects.getProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const row = await deps.store.createSession({
      projectId,
      title: "New chat",
      anonymousId,
    });
    return toSessionDTO(row);
  }

  async function listSessions(projectId?: string, anonymousId?: string) {
    const rows = await deps.store.listSessions({ projectId, anonymousId });
    return rows.map(toSessionDTO);
  }

  async function getMessages(sessionId: string) {
    const session = await deps.store.getSession(sessionId);
    if (!session) return null;
    const rows = await deps.store.listMessages(sessionId);
    return rows.map(toMessageDTO);
  }

  async function deleteSession(id: string) {
    const session = await deps.store.getSession(id);
    if (!session) return false;
    await deps.store.deleteSession(id);
    return true;
  }

  return {
    createSession,
    listSessions,
    getMessages,
    deleteSession,
    streamMessage,
  };
}

export const chatService = createChatService();

export class SessionNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Chat session not found");
  }
}
