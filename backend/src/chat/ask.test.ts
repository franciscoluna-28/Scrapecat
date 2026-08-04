import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/projects/stores/projects-store", () => ({
  getProjectById: vi.fn(),
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
import { embedTexts } from "@/projects/embeddings";
import { searchChunks } from "@/projects/retrieval";
import { resolveApiKey } from "@/credentials/services";
import { callAI } from "@/reports/ai";
import { askAboutProject, ChatError } from "@/chat/ask";

describe("askAboutProject", () => {
  beforeEach(() => {
    vi.mocked(projectsStore.getProjectById).mockReset();
    vi.mocked(embedTexts).mockReset();
    vi.mocked(searchChunks).mockReset();
    vi.mocked(resolveApiKey).mockReset();
    vi.mocked(callAI).mockReset();
  });

  it("embeds the question, retrieves chunks, and answers", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue({
      id: "p1",
      githubProjectId: 1,
      githubOwner: "owner",
      repositoryName: "repo",
      defaultBranch: "main",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const queryVector = Array.from({ length: 1536 }, (_, i) => i);
    vi.mocked(embedTexts).mockResolvedValue([queryVector]);
    vi.mocked(searchChunks).mockResolvedValue([
      {
        id: "c1",
        commitSha: "abcdef1234",
        commitMessage: "feat: add credential encryption",
        author: "franciscoluna-28",
        diffSummary: "feat: add credential encryption",
        committedAt: new Date(),
        similarity: 0.9,
      },
    ]);
    vi.mocked(resolveApiKey).mockResolvedValue("sk-test");
    vi.mocked(callAI).mockResolvedValue({
      content: "AES-256-GCM encryption was added in abcdef1.",
      finishReason: "stop",
    });

    const result = await askAboutProject({
      projectId: "p1",
      question: "When was encryption added?",
    });

    expect(embedTexts).toHaveBeenCalledWith(["When was encryption added?"]);
    expect(searchChunks).toHaveBeenCalledWith({ projectId: "p1", queryVector, limit: 5 });
    expect(callAI).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 1024 }));
    expect(result.answer).toContain("AES-256-GCM");
    expect(result.sources[0].similarity).toBe(0.9);
  });

  it("throws a 404 ChatError when the project does not exist", async () => {
    vi.mocked(projectsStore.getProjectById).mockResolvedValue(null);

    await expect(askAboutProject({ projectId: "nope", question: "hi" })).rejects.toThrow(ChatError);
  });
});
