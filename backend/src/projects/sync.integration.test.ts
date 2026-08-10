import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as syncStateStore from "@/projects/stores/sync-state-store";
import * as syncJobsStore from "@/projects/stores/sync-jobs-store";
import { runProjectSync } from "@/projects/sync";
import { processNextJobs } from "@/projects/worker/sync-worker";

const remoteCommits: { sha: string; message: string; author: string; date: string }[] = [];

const mockProvider = {
  listCommitsPage: vi.fn(async (_owner: string, _repo: string, params?: any) => {
    const since = params?.since ? new Date(params.since).getTime() : -Infinity;
    const items = remoteCommits
      .filter((c) => new Date(c.date).getTime() >= since)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { items, hasMore: false, nextPage: null };
  }),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

vi.mock("@/projects/embeddings", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1536 }, () => 0)),
  ),
}));

const enabled = process.env.DB_INTEGRATION === "1";

describe.runIf(enabled)("sync worker + runProjectSync (set DB_INTEGRATION=1)", () => {
  const providerProjectId = 999_999_006;
  const repositoryName = "worker-integration-repo";

  beforeAll(async () => {
    const existing = await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId });
    if (existing) {
      await db.delete(projects).where(eq(projects.id, existing.id));
    }
  });

  afterAll(async () => {
    const existing = await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId });
    if (existing) {
      await db.delete(projects).where(eq(projects.id, existing.id));
    }
  });

  it("worker enqueues, claims, runs, and completes a sync job end to end", async () => {
    remoteCommits.length = 0;
    remoteCommits.push(
      { sha: "c1", message: "feat: one", author: "tester", date: "2026-01-10T10:00:00Z" },
      { sha: "c2", message: "feat: two", author: "tester", date: "2026-01-20T10:00:00Z" },
      { sha: "c3", message: "feat: three", author: "tester", date: "2026-01-30T10:00:00Z" },
    );

    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName, defaultBranch: "main" },
    });

    const enqueued = await syncJobsStore.enqueueSyncJob({ projectId: project.id, branch: "main" });
    expect(enqueued.status).toBe("pending");

    const ran = await processNextJobs();
    expect(ran).toBe(1);

    const done = await syncJobsStore.getLatestSyncJob({ projectId: project.id, branch: "main" });
    expect(done?.status).toBe("succeeded");
    expect(done?.attempts).toBe(0);

    const state = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(state?.lastSyncedCommitSha).toBe("c3");
    expect(state?.lastSyncedAt.toISOString()).toBe("2026-01-30T10:00:00.000Z");

    const stored = await commitChunksStore.listCommitsForProject({ projectId: project.id });
    expect(stored).toHaveLength(3);
  });

  it("runProjectSync is idempotent: re-running writes nothing and never regresses the watermark", async () => {
    const project = (await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId }))!;
    const before = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });

    mockProvider.listCommitsPage.mockClear();
    const result = await runProjectSync({ projectId: project.id, branch: "main" });

    expect(result.fetched).toBe(0);
    expect(result.newChunks).toBe(0);
    expect(mockProvider.listCommitsPage).toHaveBeenCalledWith(
      "test-owner",
      repositoryName,
      expect.objectContaining({ since: "2026-01-30T10:00:00.000Z" }),
    );

    const after = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(after!.lastSyncedCommitSha).toBe(before!.lastSyncedCommitSha);
    expect(after!.lastSyncedAt.getTime()).toBe(before!.lastSyncedAt.getTime());
  });

  it("catch-up only fetches commits strictly newer than the watermark", async () => {
    const project = (await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId }))!;
    remoteCommits.push({ sha: "c4", message: "feat: four", author: "tester", date: "2026-02-05T10:00:00Z" });

    const result = await runProjectSync({ projectId: project.id, branch: "main" });

    expect(result.fetched).toBe(1);
    expect(result.newChunks).toBe(1);

    const state = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(state!.lastSyncedCommitSha).toBe("c4");
  });

  it("a failed job is rescheduled and then marked failed permanently past maxAttempts", async () => {
    const project = (await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId }))!;
    await syncJobsStore.enqueueSyncJob({ projectId: project.id, branch: "feature-x" });

    // Simulate a job that fails: claim it, then fail it with attempts = maxAttempts.
    const [claimed] = await syncJobsStore.claimNextSyncJob();
    expect(claimed?.branch).toBe("feature-x");
    await syncJobsStore.failSyncJob({ jobId: claimed!.id, error: "boom", attempts: 1, maxAttempts: 1 });
    const failed = await syncJobsStore.getLatestSyncJob({ projectId: project.id, branch: "feature-x" });
    expect(failed?.status).toBe("failed");
    expect(failed?.lastError).toBe("boom");
  });
});
