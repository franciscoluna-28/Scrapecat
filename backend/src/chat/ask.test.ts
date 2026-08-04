import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/projects/stores/projects-store", () => ({
  getProjectById: vi.fn(),
}));
vi.mock("@/projects/stores/commit-chunks-store", () => ({
  countChunksForProject: vi.fn(),
}));
vi.mock("@/projects/embeddings", () => ({
  embedTexts: vi.fn(),
}));
vi.mock("@/projects/retrieval", () => ({
  searchChunks: vi.fn(),
}));
vi.mock("@/credentials/services", () => ({
  resolveApiKey: vi.fn(),
}));
vi.mock("@/reports/ai", () => ({
  callAI: vi.fn(),
  cleanResponse: (s: string) => s,
}));

import * as projectsStore from "@/projects/stores/projects-store";
import { countChunksForProject } from "@/projects/stores/commit-chunks-store";
import { embedTexts } from "@/projects/embeddings";
import { searchChunks } from "@/projects/retrieval";
import { resolveApiKey } from "@/credentials/services";
import { callAI } from "@/reports/ai";
import { askAboutProject, ChatError } from "@/chat/ask";

const PROJECT = {
  id: "p1",
  githubProjectId: 1,
  githubOwner: "owner",
  repositoryName: "repo",
  defaultBranch: "main",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function queryVector() {
  return Array.from({ length: 1536 }, (_, i) => i);
}

describe("askAboutProject", () => {
  beforeEach(() => {
    vi.mocked(projectsStore.getProjectById).mockReset();
    vi.mocked(countChunksForProject).mockReset();
    vi.mocked(embedTexts).mockReset();
    vi.mocked(searchChunks).mockReset();
    vi.mocked(resolveApiKey).mockReset();
    vi.mocked(callAI).mockReset();
  });

  it("embeds the question, retrieves chunks, and answers", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(PROJECT);
    vi.mocked(countChunksForProject).mockResolvedValue(10);
    const vec = queryVector();
    vi.mocked(embedTexts).mockResolvedValue([vec]);
    vi.mocked(searchChunks).mockResolvedValue([
      {
        id: "c1",
        commitSha: "abcdef1234",
        commitMessage: "feat: add credential encryption",
        author: "franciscoluna-28",
        diffSummary: "feat: add credential encryption",
        committedAt: new Date("2026-01-15T00:00:00Z"),
        similarity: 0.9,
      },
    ]);
    vi.mocked(resolveApiKey).mockResolvedValue("sk-test");
    vi.mocked(callAI).mockResolvedValue({
      content: "AES-256-GCM encryption was added in abcdef1 on 2026-01-15.",
      finishReason: "stop",
    });

    const result = await askAboutProject({
      projectId: "p1",
      question: "When was encryption added?",
    });

    expect(embedTexts).toHaveBeenCalledWith(["When was encryption added?"]);
    expect(searchChunks).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", queryVector: vec, limit: 5, minSimilarity: 0.3 }),
    );
    expect(callAI).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 1024 }));
    expect(result.answer).toContain("AES-256-GCM");
    expect(result.sources[0].similarity).toBe(0.9);
  });

  it("passes a date range to retrieval for temporal questions", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(PROJECT);
    vi.mocked(countChunksForProject).mockResolvedValue(10);
    const vec = queryVector();
    vi.mocked(embedTexts).mockResolvedValue([vec]);
    vi.mocked(searchChunks).mockResolvedValue([]);
    vi.mocked(callAI).mockResolvedValue({ content: "x", finishReason: "stop" });

    await askAboutProject({
      projectId: "p1",
      question: "what was built in august 2026?",
    });

    expect(searchChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T23:59:59.999Z"),
      }),
    );
    expect(callAI).not.toHaveBeenCalled();
  });

  it("refuses without calling the LLM when no chunks are indexed", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(PROJECT);
    vi.mocked(countChunksForProject).mockResolvedValue(0);

    const result = await askAboutProject({ projectId: "p1", question: "hi" });

    expect(result.sources).toEqual([]);
    expect(result.answer).toContain("no commits indexed");
    expect(embedTexts).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
  });

  it("refuses without calling the LLM when nothing is embedded", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(PROJECT);
    vi.mocked(countChunksForProject).mockResolvedValue(0);
    vi.mocked(countChunksForProject).mockResolvedValueOnce(10).mockResolvedValueOnce(0);

    const result = await askAboutProject({ projectId: "p1", question: "hi" });

    expect(result.answer).toContain("not embedded");
    expect(callAI).not.toHaveBeenCalled();
  });

  it("refuses without calling the LLM when retrieval finds nothing", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(PROJECT);
    vi.mocked(countChunksForProject).mockResolvedValue(10);
    vi.mocked(embedTexts).mockResolvedValue([queryVector()]);
    vi.mocked(searchChunks).mockResolvedValue([]);

    const result = await askAboutProject({ projectId: "p1", question: "hi" });

    expect(result.sources).toEqual([]);
    expect(result.answer).toContain("No commits in the index match");
    expect(callAI).not.toHaveBeenCalled();
  });

  it("throws a 404 ChatError when the project does not exist", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(null as any);

    await expect(askAboutProject({ projectId: "nope", question: "hi" })).rejects.toThrow(ChatError);
  });
});
