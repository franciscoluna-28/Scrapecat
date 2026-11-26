import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  jobs,
  type JobError,
  type JobProgress,
  type JobRow,
} from "@/db/schema";

const ACTIVE_STATUSES = ["queued", "running"] as const;
const WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const WAIT_POLL_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueJob(input: {
  type: string;
  idempotencyKey?: string;
  payload?: unknown;
  maxAttempts?: number;
}): Promise<JobRow> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [inserted] = await db
      .insert(jobs)
      .values({
        type: input.type,
        payload: input.payload ?? {},
        idempotencyKey: input.idempotencyKey ?? null,
        maxAttempts: input.maxAttempts ?? 3,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted;

    if (input.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.idempotencyKey, input.idempotencyKey),
            inArray(jobs.status, [...ACTIVE_STATUSES]),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }

    await sleep(50);
  }

  throw new Error(`Unable to enqueue job "${input.type}"`);
}

export async function getJob(id: string): Promise<JobRow | null> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row ?? null;
}

export async function claimNextJob(): Promise<JobRow | null> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, new Date())))
      .orderBy(asc(jobs.runAt), asc(jobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;

    const [updated] = await tx
      .update(jobs)
      .set({
        status: "running",
        startedAt: new Date(),
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id))
      .returning();
    return updated ?? null;
  });
}

export async function updateJobProgress(
  id: string,
  progress: JobProgress,
): Promise<void> {
  await db
    .update(jobs)
    .set({ progress, updatedAt: new Date() })
    .where(and(eq(jobs.id, id), inArray(jobs.status, [...ACTIVE_STATUSES])));
}

export async function completeJob(
  id: string,
  result: unknown,
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "succeeded",
      result: (result ?? null) as unknown,
      error: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function failJob(
  job: JobRow,
  error: JobError,
): Promise<void> {
  const giveUp = job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set(
      giveUp
        ? {
            status: "failed",
            error,
            finishedAt: new Date(),
            updatedAt: new Date(),
          }
        : {
            status: "queued",
            error,
            runAt: new Date(
              Date.now() + Math.min(60_000, 1_000 * 2 ** Math.max(0, job.attempts - 1)),
            ),
            updatedAt: new Date(),
          },
    )
    .where(eq(jobs.id, job.id));
}

/**
 * A running job cannot survive a restart. Fail it rather than leaving chat
 * requests waiting forever; the next caller enqueues a fresh, idempotent job.
 */
export async function failInterruptedJobs(): Promise<number> {
  const rows = await db
    .update(jobs)
    .set({
      status: "failed",
      error: { message: "Job interrupted by server restart" },
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.status, "running"))
    .returning({ id: jobs.id });
  return rows.length;
}

export async function waitForJob<T>(
  id: string,
  onProgress?: (progress: JobProgress) => void,
): Promise<T> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let lastProgress = "";

  for (;;) {
    const job = await getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);

    if (job.progress) {
      const serialized = JSON.stringify(job.progress);
      if (serialized !== lastProgress) {
        lastProgress = serialized;
        onProgress?.(job.progress);
      }
    }

    if (job.status === "succeeded") return job.result as T;
    if (job.status === "failed") {
      const error = new Error(job.error?.message ?? "Job failed") as Error & {
        code?: string;
      };
      if (job.error?.code) error.code = job.error.code;
      throw error;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for job ${id}`);
    }

    await sleep(WAIT_POLL_MS);
  }
}
