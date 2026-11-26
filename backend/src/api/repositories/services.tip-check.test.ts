import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProjectById = vi.fn();
const mockCountChunks = vi.fn();
const mockRemoteTipSha = vi.fn();
const mockSyncGet = vi.fn();
const mockEnqueueJob = vi.fn();
const mockWaitForJob = vi.fn();

vi.mock("@/api/repositories/stores/projects-store", () => ({
  projectsStore: {
    getProjectById: (...args: unknown[]) => mockGetProjectById(...args),
  },
}));

vi.mock("@/rag/indexing/commit-chunks-store", () => ({
  commitChunksStore: {
    countChunksForProject: (...args: unknown[]) => mockCountChunks(...args),
  },
}));

vi.mock("@/rag/indexing/branch-sync-store", () => ({
  branchSyncStore: {
    get: (...args: unknown[]) => mockSyncGet(...args),
  },
}));

vi.mock("@/rag/git/git-repository-service", () => ({
  gitRepositoryService: {
    tip: (...args: unknown[]) => mockRemoteTipSha(...args),
  },
}));

vi.mock("@/shared/queue", () => ({
  enqueueJob: (...args: unknown[]) => mockEnqueueJob(...args),
  waitForJob: (...args: unknown[]) => mockWaitForJob(...args),
  runJobInline: vi.fn(),
}));

vi.mock("@/rag/indexing/jobs", () => ({}));

vi.mock("@fastify/request-context", () => ({
  requestContext: { get: () => undefined },
}));

import { prepareProjectBranch } from "@/api/repositories/services";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LAST_COMMIT = new Date("2026-01-10T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  mockGetProjectById.mockReset().mockResolvedValue({
    id: PROJECT_ID,
    gitProvider: "github",
    providerOwner: "owner",
    repositoryName: "repo",
    defaultBranch: "main",
  });
  mockCountChunks.mockReset().mockResolvedValue(5);
  mockRemoteTipSha.mockReset().mockResolvedValue("tip-1");
  mockSyncGet.mockReset().mockResolvedValue({
    tipSha: "tip-1",
    lastCommitAt: LAST_COMMIT,
    lastIngestedAt: LAST_COMMIT,
  });
  mockEnqueueJob.mockReset().mockResolvedValue({ id: "job-1" });
  mockWaitForJob.mockReset().mockResolvedValue({
    commitsFound: 1,
    chunksWritten: 1,
    tipSha: "tip-1",
  });
});

describe("prepareProjectBranch tip check", () => {
  it("skips the job when the remote tip is already indexed", async () => {
    const result = await prepareProjectBranch(PROJECT_ID, "main");

    expect(result).toMatchObject({ chunksWritten: 0, tipSha: "tip-1" });
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues with an overlap window when the tip moved", async () => {
    mockRemoteTipSha.mockResolvedValue("tip-2");
    mockWaitForJob.mockResolvedValue({
      commitsFound: 1,
      chunksWritten: 1,
      tipSha: "tip-2",
    });

    await prepareProjectBranch(PROJECT_ID, "main");

    const input = mockEnqueueJob.mock.calls[0][0];
    expect(input.idempotencyKey).toBe(`ingest:${PROJECT_ID}:main:all`);
    expect(input.payload.since).toBe(
      new Date(LAST_COMMIT.getTime() - DAY_MS).toISOString(),
    );
  });

  it("falls back to ingest when the tip check fails", async () => {
    mockRemoteTipSha.mockRejectedValue(new Error("network down"));

    await prepareProjectBranch(PROJECT_ID, "main");

    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueJob.mock.calls[0][0].payload.since).toBeUndefined();
  });
});
