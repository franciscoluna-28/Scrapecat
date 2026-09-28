import { env } from "@/config/env";
import { ingestCommits, type IngestProgress } from "@/repositories/ingest";
import { ingestCommitsFromApi } from "@/repositories/ingest-api";
import { countChunksForProject } from "@/projects/stores/commit-chunks-store";
import * as projectsStore from "@/projects/stores/projects-store";
import { isDemoBranchAllowed } from "@/shared/demo-branches";
import { logger } from "@/shared/logger";

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

  const ingestOpts = {
    owner: project.providerOwner,
    repo: project.repositoryName,
    branch,
    projectId,
    onProgress,
  };

  try {
    const result = env.isDemoMode
      ? await ingestCommitsFromApi(ingestOpts)
      : await ingestCommits(ingestOpts);
    return { branch, ...result };
  } catch (error) {
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
