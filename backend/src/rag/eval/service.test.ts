import { describe, expect, it, vi } from "vitest";
import { parseGoldenDataset } from "@/rag/eval/golden";
import { createEvalService } from "@/rag/eval/service";

const project = {
  id: "project-1",
  gitProvider: "github",
  providerProjectId: "1",
  providerOwner: "owner",
  repositoryName: "repo",
  defaultBranch: "dev",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDataset(cases?: unknown[]) {
  return parseGoldenDataset({
    version: 1,
    name: "test",
    project: {
      gitProvider: "github",
      providerOwner: "owner",
      repositoryName: "repo",
      branch: "dev",
    },
    cases: cases ?? [{ id: "one", query: "what changed?", relevantShas: ["abc"] }],
  });
}

const trace = {
  mode: "hybrid" as const,
  abstained: false,
  lexicalCandidates: 1,
  semanticCandidates: 1,
  semanticHits: 1,
  bestSemanticDistance: 0.2,
  fusedCandidates: 1,
  topFusedScore: 0.03,
  truncated: false,
};

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    projects: {
      getProjectByOwnerRepo: vi.fn(async () => project),
      upsertProject: vi.fn(async () => ({ project, created: true })),
    },
    chunks: {
      getChunksByShas: vi.fn(
        async () => new Map([["abc", { commitSha: "abc", metadata: {} }]]),
      ),
      countChunksForProject: vi.fn(async () => 1),
    },
    prepareBranch: vi.fn(async () => ({
      branch: "dev",
      commitsFound: 1,
      chunksWritten: 1,
      tipSha: "tip",
    })),
    resolveSpace: vi.fn(async () => ({
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
    })),
    retriever: {
      resolveScopeDetailed: vi.fn(async () => ({
        citations: [{ commitSha: "abc" }],
        trace,
      })),
      retrieveDetailed: vi.fn(async () => ({
        citations: [{ commitSha: "abc" }],
        trace,
      })),
    },
    ...overrides,
  };
}

describe("evalService.run", () => {
  it("prepares the branch and scores a hit", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    const result = await service.run({ dataset: makeDataset(), prepare: true });

    expect(deps.prepareBranch).toHaveBeenCalledWith("project-1", "dev");
    expect(result.report.summary.meanContextRecall).toBe(1);
    expect(result.report.cases[0].passed).toBe(true);
  });

  it("fails when judged SHAs are not indexed", async () => {
    const deps = makeDeps({
      chunks: {
        getChunksByShas: vi.fn(async () => new Map()),
        countChunksForProject: vi.fn(async () => 0),
      },
    });
    const service = createEvalService(deps as never);

    await expect(
      service.run({ dataset: makeDataset(), prepare: false }),
    ).rejects.toThrow(/not indexed/);
  });

  it("uses resolveScopeDetailed without a window and retrieveDetailed with one", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    await service.run({
      dataset: makeDataset([
        { id: "plain", query: "what changed?", relevantShas: ["abc"] },
        {
          id: "windowed",
          query: "what changed in october?",
          relevantShas: ["abc"],
          window: {
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-31T23:59:59.999Z",
          },
        },
      ]),
      prepare: false,
      topK: 5,
    });

    expect(deps.retriever.resolveScopeDetailed).toHaveBeenCalledTimes(1);
    expect(deps.retriever.resolveScopeDetailed).toHaveBeenCalledWith({
      projectId: "project-1",
      query: "what changed?",
      branch: "dev",
      limit: 5,
    });
    expect(deps.retriever.retrieveDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-10-31T23:59:59.999Z"),
      }),
    );
  });

  it("scores negative cases by requiring an empty result", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    const result = await service.run({
      dataset: makeDataset([
        { id: "none", query: "billing system?", category: "negative" },
      ]),
      prepare: false,
    });

    expect(result.report.cases[0].metrics).toBeNull();
    expect(result.report.cases[0].passed).toBe(false);
    expect(result.report.negativeAccuracy).toBe(0);
  });

  it("creates the project when preparing an unknown owner/repo", async () => {
    const deps = makeDeps({
      projects: {
        getProjectByOwnerRepo: vi.fn(async () => null),
        upsertProject: vi.fn(async () => ({ project, created: true })),
      },
    });
    const service = createEvalService(deps as never);

    await service.run({ dataset: makeDataset(), prepare: true });

    expect(deps.projects.upsertProject).toHaveBeenCalledWith(
      expect.objectContaining({
        providerProjectId: "owner/repo",
        repositoryName: "repo",
      }),
    );
  });
});
