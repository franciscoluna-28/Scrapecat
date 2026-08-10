import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { syncJobs, type syncJobStatus } from "@/db/schema";

export type SyncJobStatus = (typeof syncJobStatus)["enumValues"][number];

export type SyncJob = {
  id: string;
  projectId: string;
  branch: string;
  status: SyncJobStatus;
  attempts: number;
  lastError: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const ACTIVE_STATUSES: SyncJobStatus[] = ["pending", "running"];

type SyncJobRow = {
  id: string;
  project_id: string;
  branch: string;
  status: SyncJobStatus;
  attempts: number;
  last_error: string | null;
  scheduled_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toJob(r: SyncJobRow): SyncJob {
  return {
    id: r.id,
    projectId: r.project_id,
    branch: r.branch,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error,
    scheduledAt: r.scheduled_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Enqueues a sync job for a project+branch. Idempotent: if a pending/running
 * job already exists for the same project+branch, it is not duplicated.
 */
export async function enqueueSyncJob({
  projectId,
  branch,
}: {
  projectId: string;
  branch: string;
}): Promise<SyncJob> {
  const existing = await db
    .select()
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.projectId, projectId),
        eq(syncJobs.branch, branch),
        inArray(syncJobs.status, ACTIVE_STATUSES),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(syncJobs)
    .values({ projectId, branch, status: "pending", attempts: 0 })
    .returning();
  return row;
}

/**
 * Claims the oldest pending jobs. Uses FOR UPDATE SKIP LOCKED so concurrent
 * workers never run the same job twice. Returns null when nothing is ready.
 */
export async function claimNextSyncJob(opts?: { limit?: number }): Promise<SyncJob[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<SyncJobRow>(sql`
      select *
      from sync_jobs
      where status = 'pending'
      order by scheduled_at asc, created_at asc
      limit ${opts?.limit ?? 1}
      for update skip locked
    `);

    const jobs = rows.map(toJob);
    for (const job of jobs) {
      await tx
        .update(syncJobs)
        .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(syncJobs.id, job.id));
    }
    return jobs;
  });
}

export async function completeSyncJob({ jobId }: { jobId: string }): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: "succeeded", finishedAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(syncJobs.id, jobId));
}

export async function failSyncJob({
  jobId,
  error,
  attempts,
  maxAttempts,
}: {
  jobId: string;
  error: string;
  attempts: number;
  maxAttempts: number;
}): Promise<void> {
  const giveUp = attempts >= maxAttempts;
  await db
    .update(syncJobs)
    .set(
      giveUp
        ? { status: "failed", finishedAt: new Date(), lastError: error, updatedAt: new Date() }
        : {
            status: "pending",
            lastError: error,
            scheduledAt: new Date(Date.now() + 1_000 * 2 ** (attempts - 1)),
            updatedAt: new Date(),
          },
    )
    .where(eq(syncJobs.id, jobId));
}

export async function getLatestSyncJob({
  projectId,
  branch,
}: {
  projectId: string;
  branch: string;
}): Promise<SyncJob | null> {
  const [row] = await db
    .select()
    .from(syncJobs)
    .where(and(eq(syncJobs.projectId, projectId), eq(syncJobs.branch, branch)))
    .orderBy(desc(syncJobs.createdAt), desc(syncJobs.id))
    .limit(1);
  return row ?? null;
}
