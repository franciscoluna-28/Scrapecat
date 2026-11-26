import { env } from "@/shared/config/env";
import type { IngestProgress, IngestResult } from "@/rag/indexing/ingest";
import { commitChunksStore } from "@/rag/indexing/commit-chunks-store";
import { branchSyncStore } from "@/rag/indexing/branch-sync-store";
import { remoteTipSha } from "@/rag/git/workspace";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import {
  isDemoBranchAllowed,
  isDemoTrunkBranch,
} from "@/shared/demo-branches";
import { logger } from "@/shared/logger";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import { enqueueJob, runJobInline, waitForJob } from "@/shared/queue";
import { JOB_NAMES, ingestBranchJobId } from "@/shared/queue/jobs";
import { PROJECT_LOG_MESSAGES } from "@/rag/indexing/log-events";
import { requestContext } from "@fastify/request-context";
import "@/rag/indexing/jobs";

// Re-index from the last known commit, minus a day of slack for author vs
// committer dates and force-pushes. Dedupe by SHA makes the overlap harmless.
const INGEST_OVERLAP_MS = 24 * 60 * 60 * 1000;

export async function listProjects() {
  const rows = await projectsStore.listProjectsWithIndexedBranches();
  return rows.map((project) => ({
    id: project.id,
    gitProvider: project.gitProvider,
    providerProjectId: project.providerProjectId,
    providerOwner: project.providerOwner,
    repositoryName: project.repositoryName,
    defaultBranch: project.defaultBranch,
    indexedBranches: project.indexedBranches,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }));
}

/**
 * Ingests a project branch, but is database-first: the database is the source
 * of truth for retrieval, and GitHub is only consulted to fill gaps.
 *
 * - Demo / serverless: if the branch already has commits in the DB, return
 *   immediately (no API call). Only fetch over the public GitHub REST API when
 *   the branch is empty, and never throw — a rate-limit or network failure
 *   falls back to whatever is already stored.
 * - Self-hosted: clone the branch archive and read commits + file diffs from
 *   local git, falling back to stored rows if the clone/fetch fails.
 *
 * Returns the branch actually ingested — in demo mode the stored default can be
 * stale (repos move between `main` and `master`), so the real default is
 * resolved on failure and used for both ingestion and retrieval.
 */
export async function prepareProjectBranch(projectId: string, branch: string, onProgress?: IngestProgress) {
  const project = await projectsStore.getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const existing = await commitChunksStore.countChunksForProject({ projectId, branch });

  // Demo only ingests trunk branches (main/master) — or the repo's real
  // default. Resolve the default server-side rather than trusting stored,
  // client-supplied project metadata.
  let demoDefaultBranch = project.defaultBranch;
  if (env.isDemoMode && !isDemoTrunkBranch(branch)) {
    try {
      demoDefaultBranch = await getGitProvider(
        project.gitProvider,
        await resolveGitToken(project.gitProvider),
      ).getDefaultBranch(project.providerOwner, project.repositoryName);
    } catch {
      // Fall back to the stored default; the allow check below still applies.
    }
  }
  if (env.isDemoMode && !isDemoBranchAllowed(branch, demoDefaultBranch)) {
    return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
  }

  // Demo is read-only from the client's perspective: serve the ingested rows.
  if (env.isDemoMode && existing > 0) {
    return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
  }

  // Self-hosted: skip the clone entirely when the remote tip is already
  // indexed. Otherwise re-index from the last commit (minus an overlap for
  // author/committer date skew and force-pushes).
  let since: Date | undefined;
  if (!env.isDemoMode) {
    try {
      const tip = await remoteTipSha({
        gitProvider: project.gitProvider,
        owner: project.providerOwner,
        repo: project.repositoryName,
        branch,
      });
      const state = await branchSyncStore.get({ projectId, branch });
      if (state?.tipSha === tip && existing > 0) {
        return { branch, commitsFound: existing, chunksWritten: 0, tipSha: tip };
      }
      const anchor = state?.lastCommitAt ?? state?.lastIngestedAt;
      if (anchor) since = new Date(anchor.getTime() - INGEST_OVERLAP_MS);
    } catch (error) {
      logger.warn(
        { projectId, branch, err: (error as Error).message },
        PROJECT_LOG_MESSAGES.ingestTipCheckFailed,
      );
    }
  }

  // The heavy ingest runs as a deduped durable job; the id is stable per
  // project+branch so concurrent callers attach to the same run.
  const ingest = async (ref: string): Promise<IngestResult> => {
    const jobId = ingestBranchJobId(projectId, ref);
    const payload = {
      gitProvider: project.gitProvider,
      owner: project.providerOwner,
      repo: project.repositoryName,
      branch: ref,
      projectId,
      since: since?.toISOString(),
      requestId: requestContext.get("reqId"),
    };
    const report = (p: { stage: string; message: string; done?: number; total?: number }) =>
      onProgress?.(p.stage as Parameters<IngestProgress>[0], p.message, p.done, p.total);

    // Serverless hosts cannot run the background worker; run inline there.
    if (env.isVercel) {
      return runJobInline<IngestResult>(JOB_NAMES.ingestBranch, payload, report);
    }

    const job = await enqueueJob({
      type: JOB_NAMES.ingestBranch,
      idempotencyKey: jobId,
      payload,
    });
    return waitForJob<IngestResult>(job.id, report);
  };

  try {
    return { branch, ...(await ingest(branch)) };
  } catch (error) {
    // Demo: the stored default branch can be stale. Resolve the repo's true
    // default and retry once so a `main`/`master` mismatch self-corrects.
    if (env.isDemoMode) {
      try {
        const actual = await getGitProvider(
          project.gitProvider,
          await resolveGitToken(project.gitProvider),
        ).getDefaultBranch(project.providerOwner, project.repositoryName);
        if (actual && actual !== branch && isDemoBranchAllowed(actual, project.defaultBranch)) {
          logger.warn(
            { projectId, branch, actual },
            PROJECT_LOG_MESSAGES.ingestRetryDefaultBranch,
          );
          return { branch: actual, ...(await ingest(actual)) };
        }
      } catch {
        // fall through to stored rows
      }
    }
    // Fallback to the database whenever ingestion fails — a visitor should
    // still get answers from already-ingested commits.
    if (existing > 0) {
      logger.warn(
        { projectId, branch, err: (error as Error).message, existing },
        PROJECT_LOG_MESSAGES.ingestServingStoredRows,
      );
      return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
    }
    throw error;
  }
}
