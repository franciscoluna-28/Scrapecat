import { env } from "@/config/env";
import type { IngestProgress, IngestResult } from "@/repositories/ingest";
import { countChunksForProject } from "@/projects/stores/commit-chunks-store";
import * as projectsStore from "@/projects/stores/projects-store";
import { isDemoBranchAllowed } from "@/shared/demo-branches";
import { logger } from "@/shared/logger";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGithubToken } from "@/github/token";
import { getJobQueue } from "@/shared/queue";
import "@/projects/jobs";

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
  const project = await projectsStore.getProjectById({ id: projectId });
  if (!project) throw new Error("Project not found");

  const existing = await countChunksForProject({ projectId, branch });

  // Demo only ingests trunk branches (main/master) — or the repo's default.
  // Anything else serves whatever was already stored, without hitting GitHub.
  if (env.isDemoMode && !isDemoBranchAllowed(branch, project.defaultBranch)) {
    return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
  }

  // Demo is read-only from the client's perspective: serve the ingested rows.
  if (env.isDemoMode && existing > 0) {
    return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
  }

  const queue = await getJobQueue();
  // The heavy ingest runs as a deduped job; same window for now (full branch),
  // so the id is stable per project+branch and concurrent callers attach.
  const ingest = (ref: string): Promise<IngestResult> => {
    const jobId = `ingest:${projectId}:${ref}:all`;
    return queue
      .enqueue("ingest-branch", jobId, {
        owner: project.providerOwner,
        repo: project.repositoryName,
        branch: ref,
        projectId,
      })
      .then(() =>
        queue.runAndWait<IngestResult>(jobId, (p) =>
          onProgress?.(p.stage as Parameters<IngestProgress>[0], p.message, p.done, p.total),
        ),
      );
  };

  try {
    return { branch, ...(await ingest(branch)) };
  } catch (error) {
    // Demo: the stored default branch can be stale. Resolve the repo's true
    // default and retry once so a `main`/`master` mismatch self-corrects.
    if (env.isDemoMode) {
      try {
        const actual = await getGitProvider(await resolveGithubToken()).getDefaultBranch(
          project.providerOwner,
          project.repositoryName,
        );
        if (actual && actual !== branch && isDemoBranchAllowed(actual, project.defaultBranch)) {
          logger.warn({ projectId, branch, actual }, "ingest failed; retrying with repo default branch");
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
        "ingest failed; serving existing database rows",
      );
      return { branch, commitsFound: existing, chunksWritten: 0, tipSha: "" };
    }
    throw error;
  }
}
