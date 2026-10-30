import type { ChatCitation } from "@/db/schema";
import {
  aiClient,
  resolveChatModel,
  type AIMessage,
  type ResolvedChatModel,
} from "@/chat/ai";
import {
  chatStore,
  type ChatMessageRow,
  type ChatSessionRow,
} from "@/chat/chat-store";
import { retriever } from "@/chat/retrieval";
import {
  buildSystemPrompt,
  buildUserMessage,
  resolvePersona,
} from "@/chat/prompts";
import type { ChatMessageDTO } from "@/chat/schemas";
import { projectsStore } from "@/projects/stores/projects-store";
import { prepareProjectBranch } from "@/projects/services";
import type { IngestProgress } from "@/repositories/ingest";

const HISTORY_LIMIT = 20;

export type ChatStreamOptions = {
  sessionId: string;
  content: string;
  branch?: string | null;
  model?: string;
  provider?: string;
  persona?: string;
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

type ProjectRow = Awaited<
  ReturnType<ChatServiceDeps["projects"]["getProjectById"]>
>;

type TurnContext = {
  session: ChatSessionRow;
  project: ProjectRow;
  branch: string;
  scope: Awaited<ReturnType<ChatServiceDeps["retriever"]["resolveScope"]>>;
  history: ChatMessageRow[];
  model: ResolvedChatModel;
};

/**
 * Chat application service. One object owns the session operations and the
 * streamed-turn pipeline; dependencies are injected so tests can swap the
 * store, project lookup, retrieval, model resolution, and AI client.
 */
export function createChatService(overrides: Partial<ChatServiceDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

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

  async function resolveBranch(
    projectId: string,
    requested: string,
    onProgress?: IngestProgress,
  ) {
    const prepared = await deps
      .prepareBranch(projectId, requested, onProgress)
      .catch(() => null);
    return prepared?.branch || requested;
  }

  function priorTurns(history: ChatMessageRow[]): AIMessage[] {
    return history
      .slice(-HISTORY_LIMIT)
      .slice(0, -1)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));
  }

  function buildMessages(
    turn: TurnContext,
    options: ChatStreamOptions,
  ): AIMessage[] {
    const now = new Date();
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          turn.project?.repositoryName,
          now,
          resolvePersona(options.persona),
        ),
      },
      ...priorTurns(turn.history),
      {
        role: "user",
        content: buildUserMessage(options.content, turn.scope.citations, {
          branch: turn.branch,
          startDate: turn.scope.startDate,
          endDate: turn.scope.endDate,
          now,
        }),
      },
    ];
  }

  async function prepareTurn(
    options: ChatStreamOptions,
  ): Promise<TurnContext> {
    const session = await requireSession(options.sessionId);
    const project = await deps.projects.getProjectById(session.projectId);

    await deps.store.addMessage({
      sessionId: options.sessionId,
      role: "user",
      content: options.content,
    });

    const requestedBranch =
      options.branch || project?.defaultBranch || "main";
    const branch = await resolveBranch(
      session.projectId,
      requestedBranch,
      options.onProgress,
    );

    const scope = await deps.retriever.resolveScope({
      projectId: session.projectId,
      query: options.content,
      branch,
    });

    const history = await deps.store.listMessages(options.sessionId);
    const model = await deps.resolveModel({
      provider: options.provider,
      model: options.model,
    });

    return { session, project, branch, scope, history, model };
  }

  async function streamMessage(
    options: ChatStreamOptions,
  ): Promise<ChatMessageDTO> {
    const turn = await prepareTurn(options);
    const messages = buildMessages(turn, options);

    const result = await deps.ai.stream(
      {
        model: turn.model,
        messages,
        sessionId: options.sessionId,
        abortSignal: options.signal,
      },
      options.onToken,
    );

    const reply = await deps.store.addMessage({
      sessionId: options.sessionId,
      role: "assistant",
      content: result.content,
      branch: turn.branch,
      citations: turn.scope.citations,
    });
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
