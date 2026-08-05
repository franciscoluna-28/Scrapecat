import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { paginate, type FetchPage } from "@/shared/integrations/git-provider/pagination";
import { buildCommitChunks, type CommitChunk } from "@/projects/chunks";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as projectsStore from "@/projects/stores/projects-store";
import * as syncStateStore from "@/projects/stores/sync-state-store";
import { env } from "@/config/env";
import type { DbOrTx, Tx } from "@/db/client";
import type { Commit } from "@/shared/integrations/git-provider";

/**
 * Composite keyset rule: a commit is "newer" than the watermark iff its
 * committed date is strictly greater, or equal with a lexicographically
 * greater SHA. This makes resume deterministic — the date orders, the SHA
 * breaks millisecond ties.
 */
export function isNewerThanWatermark(
  date: string,
  sha: string,
  wmDate: Date,
  wmSha: string,
): boolean {
  const t = new Date(date).getTime();
  const wm = wmDate.getTime();
  if (t > wm) return true;
  if (t < wm) return false;
  return sha > wmSha;
}

export type SyncResult = {
  fetched: number;
  newChunks: number;
  watermarkFrom: { sha: string; at: Date } | null;
  watermarkTo: { sha: string; at: Date } | null;
};

/**
 * The single commit-sync entry point, owned by the sync worker.
 *
 * Runs inside a transaction that takes a per-project advisory lock so
 * concurrent syncs for the same project serialize. On the first sync (no
 * watermark) it fetches the full history, newest-first; afterwards it resumes
 * from the watermark and fetches only what is strictly newer (the composite
 * `(committed_at, commit_sha)` keyset rule).
 *
 * Failure is inherently safe: the watermark only advances when this
 * transaction commits, so a run that dies mid-pagination restarts from the
 * same watermark next time (re-fetched commits are deduped by SHA).
 */
export async function runProjectSync(opts: {
  projectId: string;
  branch: string;
}): Promise<SyncResult> {
  const project = await projectsStore.getProjectById({ id: opts.projectId });
  if (!project) {
    throw new Error(`Project ${opts.projectId} not found`);
  }
  const provider = getGitProvider();

  return db.transaction(async (tx) => {
    // Per-project mutex: concurrent syncs for the same project queue here and
    // the lock releases automatically when the transaction commits/rolls back.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${opts.projectId}, 0))`,
    );

    const state = await syncStateStore.getSyncState({
      projectId: opts.projectId,
      branch: opts.branch,
      tx,
    });

    const watermarkFrom = state
      ? { sha: state.lastSyncedCommitSha, at: state.lastSyncedAt }
      : null;
    const since = state ? state.lastSyncedAt.toISOString() : undefined;

    const fetchPage: FetchPage<Commit> = (page) =>
      provider.listCommitsPage(project.githubOwner, project.repositoryName, {
        branch: opts.branch,
        since,
        page,
        perPage: 100,
      });

    // Drop anything at or below the watermark. Because GitHub returns
    // newest-first, a page that filters to empty means every later page is
    // older still — paginate stops there.
    const filteredFetch: FetchPage<Commit> = async (page) => {
      const result = await fetchPage(page);
      if (state) {
        const items = result.items.filter((c) =>
          isNewerThanWatermark(
            c.date,
            c.sha,
            state.lastSyncedAt,
            state.lastSyncedCommitSha,
          ),
        );
        return { ...result, items };
      }
      return result;
    };

    const fetched = await paginate(filteredFetch, {
      pageSize: 100,
      maxCommits: env.SYNC_MAX_COMMITS,
      maxPages: env.SYNC_MAX_PAGES,
      deadlineMs: env.SYNC_DEADLINE_MS,
      dedupeKey: (c) => c.sha,
    });

    const chunks = await buildMissingChunks({
      projectId: opts.projectId,
      commits: fetched,
      branch: opts.branch,
      tx,
    });
    if (chunks.length > 0) {
      await writeChunks({
        projectId: opts.projectId,
        chunks,
        branch: opts.branch,
        tx,
      });
    }

    // Advance the watermark to the newest commit now known to be synced, never
    // regressing below the current watermark.
    const head = fetched.reduce<{ date: number; sha: string } | null>(
      (best, c) => {
        const t = new Date(c.date).getTime();
        if (!best || t > best.date || (t === best.date && c.sha > best.sha)) {
          return { date: t, sha: c.sha };
        }
        return best;
      },
      null,
    );

    let watermarkTo: SyncResult["watermarkTo"] = null;
    if (head) {
      const headDate = new Date(head.date);
      const regresses =
        !!state &&
        (state.lastSyncedAt.getTime() > headDate.getTime() ||
          (state.lastSyncedAt.getTime() === headDate.getTime() &&
            state.lastSyncedCommitSha > head.sha));
      if (!regresses) {
        await syncStateStore.upsertSyncState({
          projectId: opts.projectId,
          branch: opts.branch,
          lastSyncedCommitSha: head.sha,
          lastSyncedAt: headDate,
          tx,
        });
        watermarkTo = { sha: head.sha, at: headDate };
      }
    }

    return {
      fetched: fetched.length,
      newChunks: chunks.length,
      watermarkFrom,
      watermarkTo,
    };
  });
}

export async function buildMissingChunks(opts: {
  projectId: string;
  commits: Commit[];
  branch?: string;
  tx?: DbOrTx;
}): Promise<CommitChunk[]> {
  const existing = await commitChunksStore.getChunksByShas({
    projectId: opts.projectId,
    shas: opts.commits.map((c) => c.sha),
    branch: opts.branch,
    tx: opts.tx,
  });

  const missing = opts.commits.filter((c) => !existing.has(c.sha));

  return buildCommitChunks(missing);
}

export async function writeChunks(opts: {
  projectId: string;
  chunks: CommitChunk[];
  branch?: string;
  tx?: Tx;
}) {
  await commitChunksStore.upsertCommitChunks({
    inputs: opts.chunks.map((c) => ({
      ...c,
      projectId: opts.projectId,
      branch: opts.branch,
    })),
    tx: opts.tx,
  });
}
