/**
 * Job names and id builders. Keep these in one place so producers
 * (`projects/services.ts`, `settings/services.ts`) and handlers
 * (`projects/jobs.ts`) cannot drift.
 */
export const JOB_NAMES = {
  ingestBranch: "ingest-branch",
  reindexEmbeddings: "reindex-embeddings",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/** Stable id: concurrent requests for the same project+branch dedupe. */
export function ingestBranchJobId(projectId: string, branch: string): string {
  return `ingest:${projectId}:${branch}:all`;
}

export const REINDEX_EMBEDDINGS_JOB_ID = JOB_NAMES.reindexEmbeddings;
