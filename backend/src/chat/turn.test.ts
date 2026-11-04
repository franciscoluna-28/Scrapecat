import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatCitation } from "@/db/schema";
import {
  createTurnResolver,
  HISTORY_LIMIT,
  type PrepareBranch,
  type TurnHistoryMessage,
} from "@/chat/turn";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-08T12:00:00.000Z");

const citation: ChatCitation = {
  commitSha: "abc123",
  commitMessage: "add rag chat",
  author: "dev",
  committedAt: "2024-01-01T00:00:00.000Z",
  filesChanged: ["src/chat/routes.ts"],
  commitUrl: "https://github.com/o/r/commit/abc123",
};

function makeResolver() {
  const projects = { getProjectById: vi.fn() };
  const retriever = { resolveScope: vi.fn(), retrieve: vi.fn() };
  const resolveModel = vi.fn();

  const resolver = createTurnResolver({
    projects: projects as never,
    retriever: retriever as never,
    resolveModel: resolveModel as never,
    now: () => NOW,
  });

  return { resolver, projects, retriever, resolveModel };
}

describe("createTurnResolver", () => {
  let deps: ReturnType<typeof makeResolver>;

  beforeEach(() => {
    deps = makeResolver();
    deps.projects.getProjectById.mockResolvedValue({
      id: PROJECT_ID,
      repositoryName: "owner/repo",
      defaultBranch: "main",
    });
    deps.retriever.resolveScope.mockResolvedValue({ citations: [citation] });
    deps.retriever.retrieve.mockResolvedValue([citation]);
    deps.resolveModel.mockResolvedValue({
      provider: "openrouter",
      model: { id: "test-model" },
    });
  });

  it("resolves the project, default branch, retrieval, model, and messages", async () => {
    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
    });

    expect(deps.projects.getProjectById).toHaveBeenCalledWith(PROJECT_ID);
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      query: "what changed?",
      branch: "main",
    });
    expect(deps.resolveModel).toHaveBeenCalledWith({
      provider: undefined,
      model: undefined,
    });
    expect(result.branch).toBe("main");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("owner/repo"),
      }),
    );
    expect(result.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("what changed?"),
      }),
    );
    expect(result.messages.at(-1)?.content).toContain("abc123");
  });

  it("uses a requested branch over the project default", async () => {
    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      branch: "feature/x",
    });

    expect(result.branch).toBe("feature/x");
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "feature/x" }),
    );
  });

  it("uses the branch returned by the prepare callback", async () => {
    const onProgress = vi.fn();
    const prepare = vi.fn().mockResolvedValue({ branch: "develop" });

    const result = await deps.resolver.resolveTurn(
      {
        projectId: PROJECT_ID,
        query: "what changed?",
        onProgress,
      },
      prepare as unknown as PrepareBranch,
    );

    expect(prepare).toHaveBeenCalledWith(PROJECT_ID, "main", onProgress);
    expect(result.branch).toBe("develop");
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("falls back to the requested branch when prepare fails", async () => {
    const prepare = vi
      .fn()
      .mockRejectedValue(new Error("ingest failed"));

    const result = await deps.resolver.resolveTurn(
      { projectId: PROJECT_ID, query: "what changed?" },
      prepare as unknown as PrepareBranch,
    );

    expect(result.branch).toBe("main");
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "main" }),
    );
  });

  it("does not require a prepare callback (MCP query-only path)", async () => {
    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      branch: "release",
    });

    expect(result.branch).toBe("release");
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "release" }),
    );
  });

  it("uses an explicit window through retrieve instead of resolveScope", async () => {
    const startDate = new Date("2026-01-01T00:00:00.000Z");
    const endDate = new Date("2026-02-01T00:00:00.000Z");

    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      window: { startDate, endDate },
    });

    expect(deps.retriever.resolveScope).not.toHaveBeenCalled();
    expect(deps.retriever.retrieve).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      query: "what changed?",
      branch: "main",
      startDate,
      endDate,
    });
    expect(result.scope.startDate).toBe(startDate);
    expect(result.scope.endDate).toBe(endDate);
    expect(result.messages.at(-1)?.content).toContain(
      `From: ${startDate.toISOString()}`,
    );
    expect(result.messages.at(-1)?.content).toContain(
      `To: ${endDate.toISOString()}`,
    );
  });

  it("caps prior history at HISTORY_LIMIT messages", async () => {
    const history: TurnHistoryMessage[] = Array.from(
      { length: HISTORY_LIMIT + 5 },
      (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `m${index}`,
      }),
    );

    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      history,
    });

    expect(result.messages).toHaveLength(1 + HISTORY_LIMIT + 1);
    expect(result.messages[1]).toEqual(
      expect.objectContaining({ content: "m5" }),
    );
    expect(result.messages[HISTORY_LIMIT]).toEqual(
      expect.objectContaining({ content: `m${HISTORY_LIMIT + 4}` }),
    );
  });

  it("uses the supplied now date for prompt anchoring", async () => {
    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      now: new Date("2026-02-03T00:00:00.000Z"),
    });

    expect(result.messages[0].content).toContain(
      "The current date is 2026-02-03",
    );
  });

  it("returns a null project with the fallback branch when the project is missing", async () => {
    deps.projects.getProjectById.mockResolvedValue(null);

    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
    });

    expect(result.project).toBeNull();
    expect(result.branch).toBe("main");
    expect(deps.retriever.resolveScope).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "main" }),
    );
  });

  it("passes the persona and model overrides into the shared turn", async () => {
    const result = await deps.resolver.resolveTurn({
      projectId: PROJECT_ID,
      query: "what changed?",
      persona: "engineer",
      provider: "openai",
      model: "gpt-4o",
    });

    expect(result.messages[0].content).toContain("briefing an engineer");
    expect(deps.resolveModel).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-4o",
    });
  });
});
