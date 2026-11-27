import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/shared/config/env";

const mocks = vi.hoisted(() => ({
  ingest: vi.fn(),
  createGitSource: vi.fn(),
  createApiSource: vi.fn(),
  getLatestCommitDate: vi.fn(),
  markIngested: vi.fn(),
  reindex: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
  fail: vi.fn(),
}));

vi.mock("@/rag/indexing/ingest", () => ({
  ingestCommits: mocks.ingest,
}));

vi.mock("@/rag/indexing/sources/git-source", () => ({
  createGitCommitSource: mocks.createGitSource,
}));

vi.mock("@/rag/indexing/sources/api-source", () => ({
  createApiCommitSource: mocks.createApiSource,
}));

vi.mock("@/rag/indexing/commit-embeddings-store", () => ({
  commitEmbeddingsStore: {
    getLatestCommitDate: mocks.getLatestCommitDate,
  },
}));

vi.mock("@/rag/indexing/branch-sync-store", () => ({
  branchSyncStore: { markIngested: mocks.markIngested },
}));

vi.mock("@/rag/indexing/reindex-embeddings", () => ({
  reindexAllProjects: mocks.reindex,
}));

vi.mock("@/rag/indexing/ingestion-telemetry", () => ({
  ingestionTelemetry: { start: mocks.start },
}));

import {
  runIngestBranchJob,
  runReindexEmbeddingsJob,
} from "@/rag/indexing/jobs";

const JOB_ID = "123e4567-e89b-12d3-a456-426614174000";
const ctx = { jobId: JOB_ID };
const report = vi.fn();

const payload = {
  gitProvider: "github" as const,
  owner: "owner",
  repo: "repo",
  branch: "main",
  projectId: "project-1",
  since: "2026-01-01T00:00:00.000Z",
  requestId: "req-1",
};

const result = {
  commitsFound: 3,
  chunksWritten: 2,
  summarized: 0,
  embedded: 1,
  gitMs: 500,
  dbMs: 30,
  embeddingMs: 40,
  embeddingProvider: "openrouter",
  embeddingModel: "openai/text-embedding-3-small",
  embeddingInputTokens: 80,
  embeddingOutputTokens: 0,
  tipSha: "tip",
};

const gitSource = { dispose: vi.fn(async () => {}) };
const apiSource = { dispose: vi.fn(async () => {}) };
const lastCommitAt = new Date("2026-02-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  env.isDemoMode = false;
  mocks.start.mockReturnValue({ finish: mocks.finish, fail: mocks.fail });
  mocks.finish.mockResolvedValue(undefined);
  mocks.fail.mockResolvedValue(undefined);
  mocks.ingest.mockResolvedValue(result);
  mocks.createGitSource.mockReturnValue(gitSource);
  mocks.createApiSource.mockReturnValue(apiSource);
  mocks.getLatestCommitDate.mockResolvedValue(lastCommitAt);
  mocks.markIngested.mockResolvedValue(undefined);
});

afterEach(() => {
  env.isDemoMode = false;
});

describe("runIngestBranchJob", () => {
  it("runs the self-hosted pipeline and records counts", async () => {
    const actual = await runIngestBranchJob(payload, report, ctx);

    expect(actual).toBe(result);
    expect(mocks.createGitSource).toHaveBeenCalledWith({
      gitProvider: "github",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });
    expect(mocks.createApiSource).not.toHaveBeenCalled();
    expect(mocks.ingest).toHaveBeenCalledWith(
      gitSource,
      expect.objectContaining({
        projectId: "project-1",
        branch: "main",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        requestId: "req-1",
        onProgress: expect.any(Function),
      }),
    );
    expect(mocks.markIngested).toHaveBeenCalledWith({
      projectId: "project-1",
      branch: "main",
      tipSha: "tip",
      lastCommitAt,
    });
    expect(mocks.start).toHaveBeenCalledWith({
      jobId: JOB_ID,
      jobType: "ingest-branch",
      projectId: "project-1",
      branch: "main",
    });
    expect(mocks.finish).toHaveBeenCalledWith({
      commitsFound: 3,
      commitsWritten: 2,
      commitsEmbedded: 1,
      gitMs: 500,
      dbMs: expect.any(Number),
      embeddingMs: 40,
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
      embeddingInputTokens: 80,
      embeddingOutputTokens: 0,
    });
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(gitSource.dispose).toHaveBeenCalledTimes(1);
  });

  it("uses the API source in demo mode and skips branch sync", async () => {
    env.isDemoMode = true;

    await runIngestBranchJob(payload, report, ctx);

    expect(mocks.createApiSource).toHaveBeenCalledTimes(1);
    expect(mocks.createGitSource).not.toHaveBeenCalled();
    expect(mocks.getLatestCommitDate).not.toHaveBeenCalled();
    expect(mocks.markIngested).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledTimes(1);
    expect(apiSource.dispose).toHaveBeenCalledTimes(1);
  });

  it("records the failure, disposes the source, and rethrows", async () => {
    const error = Object.assign(new Error("branch missing"), {
      code: "BranchNotFound",
    });
    mocks.ingest.mockRejectedValueOnce(error);

    await expect(runIngestBranchJob(payload, report, ctx)).rejects.toBe(error);

    expect(mocks.fail).toHaveBeenCalledWith(error);
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.markIngested).not.toHaveBeenCalled();
    expect(gitSource.dispose).toHaveBeenCalledTimes(1);
  });

  it("records a failure when branch sync throws after ingest", async () => {
    mocks.markIngested.mockRejectedValueOnce(new Error("sync down"));

    await expect(runIngestBranchJob(payload, report, ctx)).rejects.toThrow(
      "sync down",
    );

    expect(mocks.fail).toHaveBeenCalledTimes(1);
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(gitSource.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("runReindexEmbeddingsJob", () => {
  const reindexResult = {
    provider: "openrouter",
    model: "openai/text-embedding-3-small",
    projects: 2,
    embedded: 5,
    dbMs: 12,
    embeddingInputTokens: 250,
    embeddingOutputTokens: 0,
  };

  it("records the global reindex run", async () => {
    mocks.reindex.mockResolvedValueOnce(reindexResult);

    const actual = await runReindexEmbeddingsJob({}, report, ctx);

    expect(actual).toBe(reindexResult);
    expect(mocks.start).toHaveBeenCalledWith({
      jobId: JOB_ID,
      jobType: "reindex-embeddings",
    });
    expect(mocks.finish).toHaveBeenCalledWith({
      commitsEmbedded: 5,
      dbMs: 12,
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
      embeddingInputTokens: 250,
      embeddingOutputTokens: 0,
    });
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("records and rethrows a reindex failure", async () => {
    const error = new Error("embedding space unavailable");
    mocks.reindex.mockRejectedValueOnce(error);

    await expect(runReindexEmbeddingsJob({}, report, ctx)).rejects.toBe(error);

    expect(mocks.fail).toHaveBeenCalledWith(error);
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});
