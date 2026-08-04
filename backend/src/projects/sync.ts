import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { paginate, type FetchPage } from "@/shared/integrations/git-provider/pagination";
import { buildCommitChunks, type CommitChunk } from "@/projects/chunks";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
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

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

/**
 * Shared commit sync used by both report generation and the ingestion path.
 *
 * Runs inside a transaction that takes a per-project advisory lock
 * (`pg_advisory_xact_lock`) so concurrent syncs for the same project serialize.
 *
 * Two call shapes:
 * - **Window mode** (`window` set, used by report generation): fetches the
 *   whole window, newest-first, paginated without any hard cap. Overlap with
 *   already-synced commits is deduped to zero writes. Returns the window's
 *   commits for the report prompt.
 * - **Catch-up** (no window, used by ingestion): fetches only what is strictly
 *   newer than the per-(project, branch) watermark, resuming from it.
 *
 * The watermark is advanced to the newest commit now known to be synced and
 * never regresses.
 */
export async function syncCommitsForProject(opts: {
  projectId: string;
  owner: string;
  repo: string;
  branch: string;
  window?: { startDate?: string; endDate?: string };
}): Promise<Commit[]> {
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

    const catchUp = !opts.window;
    const windowStart = opts.window?.startDate
      ? startOfDayUtc(opts.window.startDate).toISOString()
      : undefined;
    const windowEnd = opts.window?.endDate
      ? endOfDayUtc(opts.window.endDate).toISOString()
      : undefined;

    // Window mode starts at the window start; catch-up resumes from the
    // watermark. GitHub `since`/`until` filter by committer date.
    const since = windowStart ?? (state ? state.lastSyncedAt.toISOString() : undefined);

    const fetchPage: FetchPage<Commit> = (page) =>
      provider.listCommitsPage(opts.owner, opts.repo, {
        branch: opts.branch,
        since,
        until: windowEnd,
        page,
        perPage: 100,
      });

    // In catch-up mode, drop anything at or below the watermark. Because
    // GitHub returns newest-first, a page that filters to empty means every
    // later page is older still — paginate stops there.
    const filteredFetch: FetchPage<Commit> = async (page) => {
      const result = await fetchPage(page);
      if (catchUp && state) {
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

    // Advance the watermark to the newest commit we now know is synced, never
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
      }
    }

    // Window mode returns exactly the window's commits (the fetch may have
    // extended into already-synced territory for overlap); catch-up returns
    // the newly-fetched commits.
    if (opts.window) {
      const startT = opts.window.startDate
        ? startOfDayUtc(opts.window.startDate).getTime()
        : -Infinity;
      const endT = opts.window.endDate
        ? endOfDayUtc(opts.window.endDate).getTime()
        : Infinity;
      return fetched.filter((c) => {
        const t = new Date(c.date).getTime();
        return t >= startT && t <= endT;
      });
    }
    return fetched;
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
