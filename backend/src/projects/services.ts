import { ingestCommits } from "@/repositories/ingest";
import { ingestCommitsFromApi } from "@/repositories/ingest-api";
import { isInMemoryMode } from "@/db/client";
import * as projectsStore from "@/projects/stores/projects-store";

export async function prepareProjectBranch(projectId: string, branch: string) {
  const project = await projectsStore.getProjectById({ id: projectId });
  if (!project) throw new Error("Project not found");

  // Stateless (demo) deployments have no git binary/persistent archive — fall
  // back to the GitHub REST API for ingestion. The open-source default keeps
  // using the local archive pipeline.
  if (isInMemoryMode) {
    const apiResult = await ingestCommitsFromApi({
      owner: project.providerOwner,
      repo: project.repositoryName,
      branch,
      projectId,
    });
    return { branch, ...apiResult };
  }

  const result = await ingestCommits({
    owner: project.providerOwner,
    repo: project.repositoryName,
    branch,
    projectId,
  });

  return { branch, ...result };
}
