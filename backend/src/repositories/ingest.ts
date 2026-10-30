import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import {
  commitChunksStore,
  type CommitChunkInput,
} from "@/projects/stores/commit-chunks-store";
import { embedNewChunks } from "@/projects/embed-chunks";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  tipSha: string;
};

export type IngestProgress = (
  stage: "archive" | "commits" | "ingest" | "embedding",
  message: string,
  done?: number,
  total?: number,
) => void;

/** A commit as seen by a source, before file scope / guardrail are applied. */
export type SourceCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  parentSha?: string | null;
  /** Provider commit URL when the source has one (API); git builds its own. */
  url?: string;
};

export type SourceContext = {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
};

/**
 * A place commits come from. The orchestrator (`ingestCommits`) owns the common
 * pipeline — dedupe by SHA, batched upsert, embedding, progress, logging — while
 * each source owns only how commits are listed and turned into chunk rows.
 *
 * The source-specific parts are deliberate and preserved:
 * - `listCommits` also resolves the source's own `tipSha`.
 * - `toChunkInputs` owns file-scope fetching and (git-only) guardrail.
 * - `batchSize` controls upsert granularity: 50 for git, unbounded for the API
 *   path (a single upsert, matching its previous behavior).
 */
export interface CommitSource {
  batchSize: number;
  listCommits(opts: {
    since?: Date;
    until?: Date;
  }): Promise<{ commits: SourceCommit[]; tipSha: string }>;
  toChunkInputs(
    commits: SourceCommit[],
    ctx: SourceContext,
  ): Promise<{ inputs: CommitChunkInput[]; skipped: number }>;
}

/**
 * Ingests the commit window for a repo branch into `commit_chunks`.
 *
 * 1. List commits from the source within `[startDate, endDate]`.
 * 2. Dedupe by SHA against already-stored chunks — *before* any file-scope work,
 *    so existing commits are never re-diffed.
 * 3. Enrich + upsert in `source.batchSize` batches (git: 50; API: one batch).
 * 4. Trigger embedding when anything was written.
 *
 * `onProgress` reports stages so the caller can persist + stream live status.
 */
export async function ingestCommits(
  source: CommitSource,
  opts: {
    owner: string;
    repo: string;
    branch: string;
    projectId: string;
    startDate?: Date;
    endDate?: Date;
    requestId?: string;
    onProgress?: IngestProgress;
  },
): Promise<IngestResult> {
  const { owner, repo, branch, projectId, startDate, endDate, onProgress } = opts;
  const base = { owner, repo, branch, projectId, ...(opts.requestId ? { reqId: opts.requestId } : {}) };

  const { commits, tipSha } = await source.listCommits({ since: startDate, until: endDate });
  onProgress?.("commits", `Found ${commits.length} commits`, commits.length, commits.length);

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

  const batchSize = source.batchSize;
  let chunksWritten = 0;
  let skipped = 0;

  for (let i = 0; i < newCommits.length; i += batchSize) {
    const batch = newCommits.slice(i, i + batchSize);
    const batchStart = performance.now();

    const { inputs, skipped: batchSkipped } = await source.toChunkInputs(batch, {
      owner,
      repo,
      branch,
      projectId,
    });
    skipped += batchSkipped;

    if (inputs.length > 0) {
      await commitChunksStore.upsertCommitChunks(inputs);
      chunksWritten += inputs.length;
    }

    const processed = Math.min(i + batch.length, newCommits.length);
    logger.info(
      {
        ...base,
        batchIndex: i / batchSize,
        processed,
        total: newCommits.length,
        chunksWritten,
        skipped,
        durationMs: Math.round(performance.now() - batchStart),
      },
      "ingest batch complete",
    );
    onProgress?.(
      "ingest",
      `Stored ${chunksWritten} of ${newCommits.length} commits`,
      processed,
      newCommits.length,
    );
  }

  let embedded = 0;
  const expectsEmbedding = chunksWritten > 0;
  if (expectsEmbedding) {
    onProgress?.("embedding", "Embedding commit summaries");
  }
  // Always re-check pending embeddings: a previous run may have stored chunks
  // before the provider was available. `embedNewChunks` no-ops when none are
  // pending, and a failure must not fail the whole ingest.
  try {
    const result = await timed("ingest.embedNewChunks", base, () => embedNewChunks(projectId));
    embedded = result.embedded;
  } catch (error) {
    logger.warn(
      { ...base, err: (error as Error)?.message ?? String(error) },
      "ingest.embeddingSkipped",
    );
    if (expectsEmbedding) {
      onProgress?.("embedding", "Commits stored; embeddings will run later");
    }
  }

  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten,
      skipped,
      embedded,
      tipSha,
    },
    "ingest complete",
  );

  return { commitsFound: commits.length, chunksWritten, tipSha };
}
