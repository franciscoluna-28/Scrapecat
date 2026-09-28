import { embedNewChunks } from "@/projects/embed-chunks";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { getChangedFilesForShas, listCommitsFromApi } from "@/repositories/github-api";
import type { IngestProgress, IngestResult } from "@/repositories/ingest";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";

/**
 * Ingest path for demo / serverless deployments: reads commits from the GitHub
 * REST API via Octokit instead of a local `git` archive. No `git` binary, no
 * persistent disk — only Postgres and outbound HTTPS.
 *
 * Public repos only. Use a fine-grained PAT scoped to "Public repositories
 * (read-only)" so the token can never read private repos or account data.
 */
export async function ingestCommitsFromApi(opts: {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
  startDate?: Date;
  endDate?: Date;
  onProgress?: IngestProgress;
}): Promise<IngestResult> {
  const { owner, repo, branch, projectId, startDate, endDate, onProgress } = opts;
  const base = { owner, repo, branch, projectId };

  const commits = await timed("ingestApi.listCommits", base, () =>
    listCommitsFromApi({ owner, repo, branch, since: startDate, until: endDate }),
  );
  onProgress?.("commits", `Found ${commits.length} commits`, commits.length, commits.length);

  const existing = await timed("ingestApi.getChunksByShas", { ...base, shas: commits.length }, () =>
    commitChunksStore.getChunksByShas({
      projectId,
      shas: commits.map((c) => c.sha),
      branch,
    }),
  );
  const newCommits = commits.filter((c) => !existing.has(c.sha));

  const filesBySha = await timed("ingestApi.getChangedFiles", { ...base, count: newCommits.length }, () =>
    getChangedFilesForShas({ owner, repo, shas: newCommits.map((c) => c.sha) }),
  );

  const inputs = newCommits.map((c) => ({
    projectId,
    commitSha: c.sha,
    branch,
    commitMessage: c.message,
    author: c.author,
    metadata: {
      filesChanged: (filesBySha.get(c.sha) ?? []).map((f) => f.filepath),
      commitUrl: c.url,
    },
    committedAt: new Date(c.date),
  }));

  if (inputs.length > 0) {
    await commitChunksStore.upsertCommitChunks({ inputs });
    onProgress?.(
      "ingest",
      `Stored ${inputs.length} of ${commits.length} commits`,
      inputs.length,
      commits.length,
    );
  }

  let embedded = 0;
  if (inputs.length > 0) {
    onProgress?.("embedding", "Embedding commit summaries");
    const result = await timed("ingestApi.embedNewChunks", base, () => embedNewChunks(projectId));
    embedded = result.embedded;
  }

  const tipSha = commits[0]?.sha ?? "";
  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten: inputs.length,
      embedded,
      tipSha,
    },
    "ingest (api) complete",
  );

  return { commitsFound: commits.length, chunksWritten: inputs.length, tipSha };
}
