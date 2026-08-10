import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncError, ensureSynced, enqueueSync } from "@/projects/sync-service";
import * as syncStateStore from "@/projects/stores/sync-state-store";
import * as syncJobsStore from "@/projects/stores/sync-jobs-store";

vi.mock("@/projects/stores/sync-state-store", () => ({
  getSyncState: vi.fn(),
}));
vi.mock("@/projects/stores/sync-jobs-store", () => ({
  enqueueSyncJob: vi.fn(),
  getLatestSyncJob: vi.fn(),
}));

describe("sync-service", () => {
  beforeEach(() => {
    vi.mocked(syncStateStore.getSyncState).mockReset();
    vi.mocked(syncJobsStore.enqueueSyncJob).mockReset();
    vi.mocked(syncJobsStore.getLatestSyncJob).mockReset();
  });

  it("ensureSynced returns fresh without enqueueing when the watermark covers the needed point", async () => {
    vi.mocked(syncStateStore.getSyncState).mockResolvedValue({
      projectId: "p1",
      branch: "main",
      lastSyncedCommitSha: "sha",
      lastSyncedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const result = await ensureSynced({
      projectId: "p1",
      branch: "main",
      needByUtc: new Date("2026-08-31T23:59:59.999Z"),
      timeoutMs: 500,
    });

    expect(result).toBe("fresh");
    expect(syncJobsStore.enqueueSyncJob).not.toHaveBeenCalled();
  });

  it("ensureSynced delegates to the worker and waits until the watermark advances", async () => {
    vi.mocked(syncStateStore.getSyncState)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        projectId: "p1",
        branch: "main",
        lastSyncedCommitSha: "sha2",
        lastSyncedAt: new Date("2026-09-01T00:00:00Z"),
      });
    vi.mocked(syncJobsStore.getLatestSyncJob).mockResolvedValue(null);

    const result = await ensureSynced({
      projectId: "p1",
      branch: "main",
      needByUtc: new Date("2026-08-31T23:59:59.999Z"),
      timeoutMs: 5000,
    });

    expect(result).toBe("fresh");
    expect(syncJobsStore.enqueueSyncJob).toHaveBeenCalledWith({ projectId: "p1", branch: "main" });
  });

  it("ensureSynced stops when a recent catch-up succeeded even if the watermark is behind (branch tip reached)", async () => {
    vi.mocked(syncStateStore.getSyncState).mockResolvedValue({
      projectId: "p1",
      branch: "main",
      lastSyncedCommitSha: "sha",
      lastSyncedAt: new Date("2026-08-03T10:00:00Z"),
    });
    vi.mocked(syncJobsStore.getLatestSyncJob).mockResolvedValue({
      id: "job-done",
      projectId: "p1",
      branch: "main",
      status: "succeeded",
      attempts: 1,
      lastError: null,
      scheduledAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await ensureSynced({
      projectId: "p1",
      branch: "main",
      needByUtc: new Date("2026-08-04T23:59:59.999Z"),
      timeoutMs: 1000,
    });

    expect(result).toBe("synced");
    expect(syncJobsStore.enqueueSyncJob).not.toHaveBeenCalled();
  });

  it("ensureSynced throws SyncError on timeout", async () => {
    vi.mocked(syncStateStore.getSyncState).mockResolvedValue(null);
    vi.mocked(syncJobsStore.enqueueSyncJob).mockResolvedValue({
      id: "job1",
      projectId: "p1",
      branch: "main",
      status: "pending",
      attempts: 0,
      lastError: null,
      scheduledAt: new Date(),
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(syncJobsStore.getLatestSyncJob).mockResolvedValue(null);

    await expect(
      ensureSynced({
        projectId: "p1",
        branch: "main",
        needByUtc: new Date(),
        timeoutMs: 50,
      }),
    ).rejects.toThrow(SyncError);
  });

  it("ensureSynced surfaces a permanent job failure", async () => {
    vi.mocked(syncStateStore.getSyncState).mockResolvedValue(null);
    vi.mocked(syncJobsStore.enqueueSyncJob).mockResolvedValue({
      id: "job1",
      projectId: "p1",
      branch: "main",
      status: "pending",
      attempts: 0,
      lastError: null,
      scheduledAt: new Date(),
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(syncJobsStore.getLatestSyncJob).mockResolvedValue({
      id: "job1",
      projectId: "p1",
      branch: "main",
      status: "failed",
      attempts: 3,
      lastError: "github 404",
      scheduledAt: new Date(),
      startedAt: null,
      finishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      ensureSynced({ projectId: "p1", branch: "main", needByUtc: new Date(), timeoutMs: 5000 }),
    ).rejects.toThrow("github 404");
  });

  it("enqueueSync delegates to the jobs store", async () => {
    vi.mocked(syncJobsStore.enqueueSyncJob).mockResolvedValue({
      id: "job1",
      projectId: "p1",
      branch: "main",
      status: "pending",
      attempts: 0,
      lastError: null,
      scheduledAt: new Date(),
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await enqueueSync({ projectId: "p1", branch: "main" });

    expect(result).toEqual({ jobId: "job1", status: "pending" });
  });
});
