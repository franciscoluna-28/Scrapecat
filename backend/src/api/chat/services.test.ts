import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatService,
  SessionNotFoundError,
} from "@/api/chat/services";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const userRow = {
  id: "user-message",
  sessionId: SESSION_ID,
  role: "user" as const,
  content: "what changed?",
  branch: null,
  citations: [],
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

const assistantRow = {
  id: "assistant-message",
  sessionId: SESSION_ID,
  role: "assistant" as const,
  content: "Added chat.",
  branch: "main",
  citations: [
    {
      commitSha: "abc123",
      commitMessage: "add rag chat",
      author: "dev",
      committedAt: "2024-01-01T00:00:00.000Z",
      filesChanged: [],
      commitUrl: null,
    },
  ],
  createdAt: new Date("2024-01-01T00:00:01.000Z"),
};

function makeService() {
  const store = {
    getSession: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(),
    addMessage: vi.fn(),
    findMessageByClientId: vi.fn(),
    listMessages: vi.fn(),
    deleteSession: vi.fn(),
    touchSession: vi.fn(),
  };
  const projects = { getProjectById: vi.fn() };
  const ai = { stream: vi.fn() };
  const resolveModel = vi.fn();
  const retriever = { retrieve: vi.fn(), resolveScope: vi.fn() };
  const prepareBranch = vi.fn();

  const service = createChatService({
    store: store as never,
    projects: projects as never,
    ai: ai as never,
    resolveModel,
    retriever: retriever as never,
    prepareBranch: prepareBranch as never,
  });

  return {
    service,
    store,
    projects,
    ai,
    resolveModel,
    retriever,
    prepareBranch,
  };
}

describe("createChatService", () => {
  let deps: ReturnType<typeof makeService>;

  beforeEach(() => {
    deps = makeService();
    deps.store.getSession.mockResolvedValue({
      id: SESSION_ID,
      projectId: PROJECT_ID,
    });
    deps.projects.getProjectById.mockResolvedValue({
      id: PROJECT_ID,
      repositoryName: "owner/repo",
      defaultBranch: "main",
    });
    deps.store.addMessage
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce(assistantRow);
    deps.store.listMessages.mockResolvedValue([]);
    deps.prepareBranch.mockResolvedValue({ branch: "main" });
    deps.retriever.resolveScope.mockResolvedValue({
      citations: assistantRow.citations,
    });
    deps.resolveModel.mockResolvedValue({ provider: "openrouter" });
    deps.ai.stream.mockImplementation(async (_request, onToken) => {
      onToken("Added");
      onToken(" chat.");
      return { content: "Added chat.", finishReason: "stop" };
    });
  });

  it("rejects when the session does not exist", async () => {
    deps.store.getSession.mockResolvedValue(null);

    await expect(
      deps.service.streamMessage({
        sessionId: SESSION_ID,
        content: "hello",
        onToken: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("persists the user, streams the reply, and persists it with citations", async () => {
    const tokens: string[] = [];

    const message = await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "what changed?",
      onToken: (chunk) => tokens.push(chunk),
    });

    expect(tokens).toEqual(["Added", " chat."]);
    expect(deps.store.addMessage).toHaveBeenNthCalledWith(1, {
      sessionId: SESSION_ID,
      role: "user",
      content: "what changed?",
    });
    expect(deps.store.addMessage).toHaveBeenNthCalledWith(2, {
      sessionId: SESSION_ID,
      role: "assistant",
      content: "Added chat.",
      branch: "main",
      citations: assistantRow.citations,
    });
    expect(deps.store.touchSession).toHaveBeenCalledWith(SESSION_ID);
    expect(message).toEqual({
      id: assistantRow.id,
      role: "assistant",
      content: "Added chat.",
      branch: "main",
      citations: assistantRow.citations,
      createdAt: assistantRow.createdAt.toISOString(),
    });
  });

  it("falls back to the project default branch", async () => {
    deps.projects.getProjectById.mockResolvedValue({
      id: PROJECT_ID,
      repositoryName: "owner/repo",
      defaultBranch: "develop",
    });

    await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "hello",
      onToken: vi.fn(),
    });

    expect(deps.prepareBranch).toHaveBeenCalledWith(
      PROJECT_ID,
      "develop",
      undefined,
    );
  });

  it("passes the resolved model overrides and assembled prompt to the client", async () => {
    await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "what changed?",
      provider: "openai",
      model: "gpt-4o",
      onToken: vi.fn(),
    });

    expect(deps.resolveModel).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-4o",
    });
    const request = deps.ai.stream.mock.calls[0][0];
    expect(request.messages[0].role).toBe("system");
    expect(request.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("what changed?"),
      }),
    );
    expect(request.messages.at(-1).content).toContain("abc123");
  });

  it("passes prior session messages as history without duplicating the current turn", async () => {
    const priorUser = {
      ...userRow,
      id: "prior-user",
      content: "earlier question",
    };
    const priorAssistant = {
      ...assistantRow,
      id: "prior-assistant",
      content: "earlier answer",
    };
    deps.store.listMessages.mockResolvedValue([priorUser, priorAssistant]);

    await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "what changed?",
      onToken: vi.fn(),
    });

    const request = deps.ai.stream.mock.calls[0][0];
    const contents = request.messages.map(
      (message: { content: string }) => message.content,
    );
    expect(contents).toContain("earlier question");
    expect(contents).toContain("earlier answer");

    const userMessages = request.messages.filter(
      (message: { role: string }) => message.role === "user",
    );
    expect(userMessages).toHaveLength(2);
    expect(
      userMessages.filter((message: { content: string }) =>
        message.content.includes("what changed?"),
      ),
    ).toHaveLength(1);
    expect(userMessages.at(-1).content).toContain("what changed?");
  });

  it("replays a completed turn for a retried client message id", async () => {
    const clientMessageId = "33333333-3333-4333-8333-333333333333";
    deps.store.findMessageByClientId.mockResolvedValue(assistantRow);

    const message = await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "what changed?",
      clientMessageId,
      onToken: vi.fn(),
    });

    expect(deps.store.findMessageByClientId).toHaveBeenCalledWith(
      SESSION_ID,
      "assistant",
      clientMessageId,
    );
    expect(deps.ai.stream).not.toHaveBeenCalled();
    expect(deps.store.addMessage).not.toHaveBeenCalled();
    expect(message.id).toBe(assistantRow.id);
  });

  it("reuses the stored turn when the assistant insert loses a race", async () => {
    const clientMessageId = "33333333-3333-4333-8333-333333333333";
    deps.store.findMessageByClientId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(assistantRow);
    deps.store.addMessage
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce(null);

    const message = await deps.service.streamMessage({
      sessionId: SESSION_ID,
      content: "what changed?",
      clientMessageId,
      onToken: vi.fn(),
    });

    expect(message.id).toBe(assistantRow.id);
    expect(deps.store.addMessage).toHaveBeenNthCalledWith(1, {
      sessionId: SESSION_ID,
      role: "user",
      content: "what changed?",
      clientMessageId,
    });
    expect(deps.store.addMessage).toHaveBeenNthCalledWith(2, {
      sessionId: SESSION_ID,
      role: "assistant",
      content: "Added chat.",
      branch: "main",
      citations: assistantRow.citations,
      clientMessageId,
    });
  });

  it("creates a session and returns its DTO", async () => {
    deps.store.createSession.mockResolvedValue({
      id: SESSION_ID,
      projectId: PROJECT_ID,
      title: "New chat",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    const result = await deps.service.createSession(PROJECT_ID, "visitor");

    expect(deps.store.createSession).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      title: "New chat",
      anonymousId: "visitor",
    });
    expect(result).toEqual({
      id: SESSION_ID,
      projectId: PROJECT_ID,
      title: "New chat",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("rejects session creation when the project is missing", async () => {
    deps.projects.getProjectById.mockResolvedValue(null);

    await expect(
      deps.service.createSession(PROJECT_ID, "visitor"),
    ).rejects.toThrow("Project not found");
    expect(deps.store.createSession).not.toHaveBeenCalled();
  });

  it("returns null messages when the session is missing", async () => {
    deps.store.getSession.mockResolvedValue(null);

    await expect(deps.service.getMessages(SESSION_ID)).resolves.toBeNull();
    expect(deps.store.listMessages).not.toHaveBeenCalled();
  });

  it("deletes an existing session", async () => {
    await expect(deps.service.deleteSession(SESSION_ID)).resolves.toBe(true);
    expect(deps.store.deleteSession).toHaveBeenCalledWith(SESSION_ID);
  });
});
