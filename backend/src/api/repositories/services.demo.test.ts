import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

const mockGetProjectById = vi.fn();
const mockCountChunks = vi.fn();
const mockGetDefaultBranch = vi.fn();
const mockEnqueue = vi.fn();
const mockRunAndWait = vi.fn();

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

vi.mock("@/shared/integrations/git-provider", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/shared/integrations/git-provider")
  >();
  return {
    ...actual,
    getGitProvider: () => ({ getDefaultBranch: mockGetDefaultBranch }),
  };
});

vi.mock("@/shared/integrations/git-provider/token", () => ({
  resolveGitToken: vi.fn(async () => null),
}));

vi.mock("@/shared/queue", () => ({
  getJobQueue: () => ({ enqueue: mockEnqueue, runAndWait: mockRunAndWait }),
}));

vi.mock("@/rag/indexing/jobs", () => ({}));

vi.mock("@fastify/request-context", () => ({
  requestContext: { get: () => undefined },
}));

import { prepareProjectBranch } from "@/api/repositories/services";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("prepareProjectBranch in demo mode", () => {
  beforeEach(() => {
    mockGetProjectById.mockReset().mockResolvedValue({
      id: PROJECT_ID,
      gitProvider: "github",
      providerOwner: "owner",
      repositoryName: "repo",
      // Client-supplied/stale default claims this feature branch is allowed.
      defaultBranch: "feature/x",
    });
    mockCountChunks.mockReset().mockResolvedValue(0);
    mockGetDefaultBranch.mockReset().mockResolvedValue("main");
    mockEnqueue.mockReset().mockResolvedValue(undefined);
    mockRunAndWait.mockReset().mockResolvedValue({
      branch: "feature/x",
      commitsFound: 1,
      chunksWritten: 1,
      tipSha: "abc",
    });
  });

  it("rejects a non-trunk branch even when stored metadata allows it", async () => {
    const result = await prepareProjectBranch(PROJECT_ID, "feature/x");

    expect(result.chunksWritten).toBe(0);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("allows the provider's real default branch", async () => {
    mockGetDefaultBranch.mockResolvedValue("feature/x");

    await prepareProjectBranch(PROJECT_ID, "feature/x");

    expect(mockEnqueue).toHaveBeenCalled();
  });
});
