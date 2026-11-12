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
    cases: cases ?? [
      {
        id: "one",
        query: "what changed?",
        relevantShas: ["abc"],
      },
    ],
  });
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    projects: {
      getProjectById: vi.fn(async () => project),
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
      resolveScope: vi.fn(async () => ({ citations: [{ commitSha: "abc" }] })),
      retrieve: vi.fn(async () => [{ commitSha: "abc" }]),
    },
    ...overrides,
  };
}

describe("evalService.run", () => {
  it("prepares the branch when requested and returns a report", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    const result = await service.run({
      dataset: makeDataset(),
      prepare: true,
      allowMissing: false,
    });

    expect(deps.prepareBranch).toHaveBeenCalledWith("project-1", "dev");
    expect(result.report.summary.meanRecall).toBe(1);
    expect(result.report.cases[0].passed).toBe(true);
  });

  it("fails when judged SHAs are missing", async () => {
    const deps = makeDeps({
      chunks: {
        getChunksByShas: vi.fn(async () => new Map()),
        countChunksForProject: vi.fn(async () => 0),
      },
    });
    const service = createEvalService(deps as never);

    await expect(
      service.run({
        dataset: makeDataset(),
        prepare: false,
        allowMissing: false,
      }),
    ).rejects.toThrow(/not indexed/);
  });

  it("warns instead of failing when missing SHAs are allowed", async () => {
    const deps = makeDeps({
      chunks: {
        getChunksByShas: vi.fn(async () => new Map()),
        countChunksForProject: vi.fn(async () => 0),
      },
    });
    const service = createEvalService(deps as never);

    const result = await service.run({
      dataset: makeDataset(),
      prepare: false,
      allowMissing: true,
    });

    expect(result.check.missingShas).toEqual(["abc"]);
    expect(result.check.warnings.join("\n")).toMatch(/not indexed/);
  });

  it("uses resolveScope for cases without an explicit window", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    const result = await service.run({
      dataset: makeDataset(),
      prepare: false,
      allowMissing: false,
      topK: 5,
    });

    expect(deps.retriever.resolveScope).toHaveBeenCalledWith({
      projectId: "project-1",
      query: "what changed?",
      branch: "dev",
    });
    expect(deps.retriever.retrieve).not.toHaveBeenCalled();
    expect(result.report.summary.meanRecall).toBe(1);
  });

  it("uses retrieve with parsed dates for explicit windows", async () => {
    const deps = makeDeps();
    const service = createEvalService(deps as never);

    await service.run({
      dataset: makeDataset([
        {
          id: "one",
          query: "what changed in october?",
          relevantShas: ["abc"],
          window: {
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-31T23:59:59.999Z",
          },
        },
      ]),
      prepare: false,
      allowMissing: false,
      topK: 5,
    });

    expect(deps.retriever.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
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
      allowMissing: false,
    });

    expect(result.report.cases[0].metrics).toBeNull();
    expect(result.report.cases[0].passed).toBe(false);
    expect(result.report.negativeAccuracy).toBe(0);
  });

  it("creates the project when preparing an unknown owner/repo", async () => {
    const deps = makeDeps({
      projects: {
        getProjectById: vi.fn(async () => project),
        getProjectByOwnerRepo: vi.fn(async () => null),
        upsertProject: vi.fn(async () => ({ project, created: true })),
      },
    });
    const service = createEvalService(deps as never);

    await service.run({
      dataset: makeDataset(),
      prepare: true,
      allowMissing: false,
    });

    expect(deps.projects.upsertProject).toHaveBeenCalledWith(
      expect.objectContaining({
        providerProjectId: "owner/repo",
        repositoryName: "repo",
      }),
    );
  });
});
