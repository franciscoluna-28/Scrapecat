import { getGitProvider } from "@/shared/integrations/git-provider";
import { buildCommitChunks } from "@/projects/chunks";
import { embedNewChunks } from "@/projects/embed-chunks";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";

const MAX_LIMIT = 100;

export async function syncProjectCommits(opts: {
  projectId: string;
  owner: string;
  repo: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
}) {
  const fetched = await getGitProvider().listCommits(opts.owner, opts.repo, {
    branch: opts.branch,
    since: opts.startDate,
    until: opts.endDate,
    perPage: MAX_LIMIT,
  });

  const sorted = [...fetched].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const limited = sorted.slice(0, MAX_LIMIT);

  const existing = await commitChunksStore.getChunksByShas(
    opts.projectId,
    limited.map((c) => c.sha),
  );

  const missing = limited.filter((c) => !existing.has(c.sha));

  const chunks = await buildCommitChunks(
    getGitProvider(),
    opts.owner,
    opts.repo,
    missing,
  );
  await commitChunksStore.upsertCommitChunks(
    chunks.map((c) => ({ ...c, projectId: opts.projectId })),
  );

  void embedNewChunks(opts.projectId).catch((err: any) => {
    console.warn("Embedding sync failed (will be retried by backfill):", err?.message ?? err);
  });

  return limited;
}
