import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange } from "@/repositories/git-reader";
import { getCommitDiffStats, type CommitDiffStats } from "@/repositories/git-diff";
import { classifyCommit } from "@/repositories/guardrail";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { type CommitChunkInput } from "@/projects/stores/commit-chunks-store";
import { embedNewChunks } from "@/projects/embed-chunks";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  tipSha: string;
};

/**
 * Batch-ingests the commit window for a repo branch into `commit_chunks`.
 *
 * 1. Ensure the local git archive is current (clone or incremental fetch).
 * 2. List commits in `[startDate, endDate]` from disk (isomorphic-git).
 * 3. Diff each NEW commit against its parent to get provable scope (files,
 *    line counts) — the message can lie, the diff can't.
 * 4. Guardrail: skip empty/no-op commits, flag uninformative or lying messages.
 * 5. Upsert chunks (dedupe by sha) with the diff stats + validation status.
 * 6. Trigger embedding.
 *
 * No per-item GitHub API calls, no pagination, no watermark — the archive is
 * the source of truth and dedupe is by SHA. Diff analysis is file-level only
 * (no line-by-line code review); the commit URL is kept as the escape hatch.
 */
export async function ingestCommits(opts: {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<IngestResult> {
  const { owner, repo, branch, projectId, startDate, endDate } = opts;
  const base = { owner, repo, branch, projectId };

  const archive = await timed("ingest.ensureArchive", base, () =>
    ensureArchive({ owner, repo, branch }),
  );

  const commits = await timed(
    "ingest.listCommitsInRange",
    { ...base, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() },
    () =>
      listCommitsInRange({
        dir: archive.dir,
        ref: branch,
        since: startDate,
        until: endDate,
      }),
  );

  const existing = await timed("ingest.getChunksByShas", { ...base, shas: commits.length }, () =>
    commitChunksStore.getChunksByShas({
      projectId,
      shas: commits.map((c) => c.sha),
      branch,
    }),
  );

  const newCommits = commits.filter((c) => !existing.has(c.sha));
  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      alreadyStored: commits.length - newCommits.length,
    },
    "ingest.prepareChunks complete",
  );

  const diffs = await timed(
    "ingest.computeDiffStats",
    { ...base, commits: newCommits.length },
    () => computeDiffStatsBatched(archive.dir, newCommits),
  );

  const chunks: CommitChunkInput[] = [];
  const skipped: string[] = [];
  for (const c of newCommits) {
    const diff = diffs.get(c.sha);
    if (!diff) continue;
    const guard = classifyCommit({ message: c.message, filesChanged: diff.filesChanged });
    if (guard.status === "skipped") {
      skipped.push(c.sha);
      continue;
    }
    chunks.push({
      projectId,
      commitSha: c.sha,
      branch,
      commitMessage: c.message,
      author: c.author,
      diffSummary: c.message,
      metadata: {
        filesChanged: diff.files.map((f) => f.filepath),
        fileStats: diff.files,
        additions: diff.additions,
        deletions: diff.deletions,
        commitUrl: `https://github.com/${owner}/${repo}/commit/${c.sha}`,
        validation: { status: guard.status, notes: guard.notes },
      },
      committedAt: new Date(c.date),
    });
  }

  if (chunks.length > 0) {
    await timed("ingest.upsertCommitChunks", { ...base, chunks: chunks.length }, () =>
      commitChunksStore.upsertCommitChunks({ inputs: chunks }),
    );
  }

  let embedded = 0;
  if (chunks.length > 0) {
    const result = await timed("ingest.embedNewChunks", { ...base }, () =>
      embedNewChunks(projectId),
    );
    embedded = result.embedded;
  }

  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten: chunks.length,
      skipped: skipped.length,
      embedded,
      tipSha: archive.tipSha,
    },
    "ingest complete",
  );

  return {
    commitsFound: commits.length,
    chunksWritten: chunks.length,
    tipSha: archive.tipSha,
  };
}

const DIFF_CONCURRENCY = 8;

async function computeDiffStatsBatched(
  dir: string,
  commits: { sha: string; parentSha: string | null }[],
): Promise<Map<string, CommitDiffStats>> {
  const results = new Map<string, CommitDiffStats>();
  for (let i = 0; i < commits.length; i += DIFF_CONCURRENCY) {
    const batch = commits.slice(i, i + DIFF_CONCURRENCY);
    const computed = await Promise.all(
      batch.map(async (c) => {
        const stats = await getCommitDiffStats({
          dir,
          parentSha: c.parentSha,
          commitSha: c.sha,
        });
        return [c.sha, stats] as const;
      }),
    );
    for (const [sha, stats] of computed) results.set(sha, stats);
  }
  return results;
}
