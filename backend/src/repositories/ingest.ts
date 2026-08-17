import { env } from "@/config/env";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange, getCommitDiff } from "@/repositories/git-reader";
import { summarizeCommits, type SummarizableCommit } from "@/repositories/summarizer";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { embedNewChunks } from "@/projects/embed-chunks";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  summarized: number;
  tipSha: string;
};

/**
 * Batch-ingests the commit window for a repo branch into `commit_chunks`.
 *
 * 1. Ensure the local git archive is current (clone or incremental fetch).
 * 2. List commits in `[startDate, endDate]` from disk (isomorphic-git).
 * 3. Compute a real diff per commit.
 * 4. Summarize + validate diffs in batches with the small LLM.
 * 5. Upsert chunks (dedupe by sha) and trigger embedding.
 *
 * No per-item GitHub API calls, no pagination, no watermark — the archive is
 * the source of truth and dedupe is by SHA.
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

  const archive = await ensureArchive({ owner, repo, branch });

  const commits = await listCommitsInRange({
    dir: archive.dir,
    ref: branch,
    since: startDate,
    until: endDate,
  });

  const existing = await commitChunksStore.getChunksByShas({
    projectId,
    shas: commits.map((c) => c.sha),
    branch,
  });

  const withDiffs: SummarizableCommit[] = [];
  for (const c of commits) {
    if (existing.has(c.sha)) continue;
    const diff = await getCommitDiff({ dir: archive.dir, commit: c });
    withDiffs.push({
      sha: c.sha,
      message: c.message,
      author: c.author,
      date: c.date,
      diff,
    });
  }

  const summaries = await summarizeCommits(withDiffs);
  const summaryBySha = new Map(summaries.map((s) => [s.sha, s]));

  const chunks = withDiffs.map((c) => {
    const summary = summaryBySha.get(c.sha);
    return {
      projectId,
      commitSha: c.sha,
      branch,
      commitMessage: c.message,
      author: c.author,
      diffSummary: summary?.summary ?? fallbackOf(c),
      diffPatch: c.diff.patch,
      metadata: {
        filesChanged: c.diff.filesChanged,
        additions: c.diff.additions,
        deletions: c.diff.deletions,
        summary: { model: env.DIFF_SUMMARY_MODEL, at: new Date().toISOString() },
        validation: {
          status: summary?.validated ? ("confirmed" as const) : ("flagged" as const),
          notes: summary?.notes ?? [],
        },
      },
      committedAt: new Date(c.date),
    };
  });

  if (chunks.length > 0) {
    await commitChunksStore.upsertCommitChunks({ inputs: chunks });
  }

  let embedded = 0;
  if (chunks.length > 0) {
    const result = await embedNewChunks(projectId);
    embedded = result.embedded;
  }

  return {
    commitsFound: commits.length,
    chunksWritten: chunks.length,
    summarized: summaries.length,
    tipSha: archive.tipSha,
  };
}

function fallbackOf(c: SummarizableCommit): string {
  const files = c.diff.filesChanged.join(", ") || "(no files)";
  return `${c.message}\n\nFiles changed: ${files} (+${c.diff.additions}/-${c.diff.deletions})`;
}
