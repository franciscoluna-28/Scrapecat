"use server";

import { createProject, getProjectByRepoId } from "@/services/sqlite";
import { actionClient } from "@/lib/actions";
import { RepositoryInputDto } from "@/schemas";

export const createProjectAction = actionClient
  .inputSchema(RepositoryInputDto)
  .action(async ({ parsedInput: repository }) => {

    const existingProject = await getProjectByRepoId(repository.id);

    if (existingProject) {
      return { success: false, error: "Repository already exists" };
    }

    const project = await createProject(repository);
    
    return { success: true, project };
  });

