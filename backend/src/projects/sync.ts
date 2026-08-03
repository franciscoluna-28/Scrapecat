import { getGitProvider } from "@/shared/integrations/git-provider";
import { buildCommitChunks, type CommitChunk } from "@/projects/chunks";
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

