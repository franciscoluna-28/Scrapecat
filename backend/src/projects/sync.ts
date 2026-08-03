import { getGitProvider } from "@/shared/integrations/git-provider";
import { buildCommitChunks, type CommitChunk } from "@/projects/chunks";
import { embedNewChunks } from "@/projects/embed-chunks";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import type { DbOrTx, Tx } from "@/db/client";
import type { Commit } from "@/shared/integrations/git-provider";

export const MAX_LIMIT = 100;

export async function fetchProjectCommits(opts: {
  owner: string;
  repo: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Commit[]> {
  const fetched = await getGitProvider().listCommits(opts.owner, opts.repo, {
    branch: opts.branch,
    since: opts.startDate,
    until: opts.endDate,
    perPage: MAX_LIMIT,
  });

  const sorted = [...fetched].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return sorted.slice(0, MAX_LIMIT);
}

export async function buildMissingChunks(opts: {
  projectId: string;
  owner: string;
  repo: string;
  commits: Commit[];
  tx?: DbOrTx;
}): Promise<CommitChunk[]> {
  const existing = await commitChunksStore.getChunksByShas({
    projectId: opts.projectId,
    shas: opts.commits.map((c) => c.sha),
    tx: opts.tx,
  });

  const missing = opts.commits.filter((c) => !existing.has(c.sha));

  return buildCommitChunks(getGitProvider(), opts.owner, opts.repo, missing);
}

export async function writeChunks(opts: {
  projectId: string;
  chunks: CommitChunk[];
  tx?: Tx;
}) {
  await commitChunksStore.upsertCommitChunks({
    inputs: opts.chunks.map((c) => ({ ...c, projectId: opts.projectId })),
    tx: opts.tx,
  });
}

export async function syncProjectCommits(opts: {
  projectId: string;
  owner: string;
  repo: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
  tx?: Tx;
}) {
  const commits = await fetchProjectCommits({
    owner: opts.owner,
    repo: opts.repo,
    branch: opts.branch,
    startDate: opts.startDate,
    endDate: opts.endDate,
  });

  const chunks = await buildMissingChunks({
    projectId: opts.projectId,
    owner: opts.owner,
    repo: opts.repo,
    commits,
    tx: opts.tx,
  });
  await writeChunks({ projectId: opts.projectId, chunks, tx: opts.tx });

  void embedNewChunks(opts.projectId).catch((err: any) => {
    console.warn("Embedding sync failed (will be retried by backfill):", err?.message ?? err);
  });

  return commits;
}
