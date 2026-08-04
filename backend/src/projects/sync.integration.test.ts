import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { githubProjects } from "@/db/schema";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as syncStateStore from "@/projects/stores/sync-state-store";
import { syncCommitsForProject } from "@/projects/sync";

const remoteCommits: { sha: string; message: string; author: string; date: string }[] = [];

const mockProvider = {
  listCommitsPage: vi.fn(async (_owner: string, _repo: string, params?: any) => {
    const since = params?.since ? new Date(params.since).getTime() : -Infinity;
    const until = params?.until ? new Date(params.until).getTime() : Infinity;
    const items = remoteCommits
      .filter((c) => {
        const t = new Date(c.date).getTime();
        return t >= since && t <= until;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { items, hasMore: false, nextPage: null };
  }),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

const enabled = process.env.DB_INTEGRATION === "1";

describe.runIf(enabled)("syncCommitsForProject (set DB_INTEGRATION=1)", () => {
  const githubProjectId = 999_999_005;
  const repositoryName = "sync-integration-repo";

  beforeAll(async () => {
    const existing = await projectsStore.getProjectByGithubId({ githubProjectId });
    if (existing) {
      await db.delete(githubProjects).where(eq(githubProjects.id, existing.id));
    }
  });

  afterAll(async () => {
    const existing = await projectsStore.getProjectByGithubId({ githubProjectId });
    if (existing) {
      await db.delete(githubProjects).where(eq(githubProjects.id, existing.id));
    }
  });

  it("cold start fetches a window, writes chunks, and sets the watermark", async () => {
    remoteCommits.length = 0;
    remoteCommits.push(
      { sha: "c1", message: "feat: one", author: "tester", date: "2026-01-10T10:00:00Z" },
      { sha: "c2", message: "feat: two", author: "tester", date: "2026-01-20T10:00:00Z" },
      { sha: "c3", message: "feat: three", author: "tester", date: "2026-01-30T10:00:00Z" },
    );

    const project = await projectsStore.upsertProject({
      input: { githubProjectId, githubOwner: "test-owner", repositoryName, defaultBranch: "main" },
    });

    const commits = await syncCommitsForProject({
      projectId: project.id,
      owner: "test-owner",
      repo: repositoryName,
      branch: "main",
      window: { startDate: "2026-01-01", endDate: "2026-01-31" },
    });

    expect(commits).toHaveLength(3);
    expect(commits.map((c) => c.sha).sort()).toEqual(["c1", "c2", "c3"]);

    const stored = await commitChunksStore.listCommitsForProject({ projectId: project.id });
    expect(stored.filter((c) => c.commitSha === "c1")).toHaveLength(1);
    expect(stored).toHaveLength(3);

    const state = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(state).not.toBeNull();
    expect(state!.lastSyncedCommitSha).toBe("c3");
    expect(state!.lastSyncedAt.toISOString()).toBe("2026-01-30T10:00:00.000Z");
  });

  it("re-syncing the same window writes nothing and does not regress the watermark", async () => {
    const project = (await projectsStore.getProjectByGithubId({ githubProjectId }))!;
    const before = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });

    mockProvider.listCommitsPage.mockClear();
    const commits = await syncCommitsForProject({
      projectId: project.id,
      owner: "test-owner",
      repo: repositoryName,
      branch: "main",
      window: { startDate: "2026-01-01", endDate: "2026-01-31" },
    });

    expect(commits).toHaveLength(3);
    const stored = await commitChunksStore.listCommitsForProject({ projectId: project.id });
    expect(stored).toHaveLength(3);

    const after = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(after!.lastSyncedCommitSha).toBe(before!.lastSyncedCommitSha);
    expect(after!.lastSyncedAt.getTime()).toBe(before!.lastSyncedAt.getTime());
  });

  it("catch-up only fetches commits strictly newer than the watermark", async () => {
    const project = (await projectsStore.getProjectByGithubId({ githubProjectId }))!;
    remoteCommits.push({ sha: "c4", message: "feat: four", author: "tester", date: "2026-02-05T10:00:00Z" });

    mockProvider.listCommitsPage.mockClear();
    const commits = await syncCommitsForProject({
      projectId: project.id,
      owner: "test-owner",
      repo: repositoryName,
      branch: "main",
    });

    expect(commits.map((c) => c.sha)).toEqual(["c4"]);
    expect(mockProvider.listCommitsPage).toHaveBeenCalledWith(
      "test-owner",
      repositoryName,
      expect.objectContaining({ since: "2026-01-30T10:00:00.000Z" }),
    );

    const stored = await commitChunksStore.listCommitsForProject({ projectId: project.id });
    expect(stored).toHaveLength(4);

    const state = await syncStateStore.getSyncState({ projectId: project.id, branch: "main" });
    expect(state!.lastSyncedCommitSha).toBe("c4");
  });
});
