import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import { projectsStore } from "@/projects/stores/projects-store";
import { listProjects as listProjectsService, prepareProjectBranch } from "@/projects/services";
import { CreateProjectBody, PrepareBranchBody, ProjectIdParams } from "@/projects/schemas";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import type { Static } from "@sinclair/typebox";

function projectResponse(project: {
  id: string;
  gitProvider: string;
  providerProjectId: string;
  providerOwner: string;
  repositoryName: string;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    gitProvider: project.gitProvider,
    providerProjectId: project.providerProjectId,
    providerOwner: project.providerOwner,
    repositoryName: project.repositoryName,
    defaultBranch: project.defaultBranch,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listProjects(_req: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.send({ projects: await listProjectsService() });
  } catch (error) {
    console.error("Error listing projects:", error);
    return reply.status(500).send({ error: "Failed to list projects" });
  }
}

export async function createProject(req: FastifyRequest, reply: FastifyReply) {
  if (!env.allowAddRepos) {
    return reply.status(403).send({ error: "Adding repositories is disabled" });
  }
  const body = req.body as Static<typeof CreateProjectBody>;
  const gitProvider = body.gitProvider ?? "github";
  try {
    // Reuse an existing project for the same repo, regardless of which id
    // format created it (older rows may use `owner/repo`).
    const existing = await projectsStore.getProjectByOwnerRepo({
      gitProvider,
      providerOwner: body.providerOwner,
      repositoryName: body.repositoryName,
    });
    if (existing) {
      return reply.code(201).send(projectResponse(existing));
    }

    // Canonicalize to the provider's stable numeric repo id so every creation
    // path (demo cards, repo list, URL entry) stores the same unique value and
    // the same repo always resolves to one project row.
    let providerProjectId = body.providerProjectId;
    if (!/^\d+$/.test(providerProjectId)) {
      try {
        const resolved = await getGitProvider(
          gitProvider,
          await resolveGitToken(gitProvider),
        ).getRepositoryId(body.providerOwner, body.repositoryName);
        if (resolved) providerProjectId = resolved;
      } catch {
        // Non-resolvable (private/offline) — fall back to the client-provided id.
      }
    }

    const { project } = await projectsStore.upsertProject({
      ...body,
      gitProvider,
      providerProjectId,
    });
    return reply.code(201).send(projectResponse(project));
  } catch (error) {
    console.error("Error creating project:", error);
    return reply.status(500).send({ error: "Failed to create project" });
  }
}

export async function prepareBranch(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ProjectIdParams>;
  const { branch } = req.body as Static<typeof PrepareBranchBody>;
  try {
    return reply.send(await prepareProjectBranch(id, branch));
  } catch (error) {
    const message = (error as Error)?.message ?? "Failed to prepare branch";
    return reply.status(message === "Project not found" ? 404 : 500).send({ error: message });
  }
}
