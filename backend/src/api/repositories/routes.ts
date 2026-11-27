import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { env } from "@/shared/config/env";
import { httpErrors } from "@/shared/errors";
import { allowAddReposGuard } from "@/shared/guards";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import {
  listProjects as listProjectsService,
  prepareProjectBranch,
} from "@/api/repositories/services";
import {
  CreateProjectRoute,
  ListProjectsRoute,
  PrepareBranchRoute,
} from "@/api/repositories/schemas";
import {
  getGitProvider,
  type GitProviderId,
} from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";

function projectResponse(project: {
  id: string;
  gitProvider: GitProviderId;
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

export async function listProjects(
  _req: TypeBoxRequest<typeof ListProjectsRoute>,
  _reply: TypeBoxReply<typeof ListProjectsRoute>,
) {
  return { projects: await listProjectsService() };
}

export async function createProject(
  req: TypeBoxRequest<typeof CreateProjectRoute>,
  reply: TypeBoxReply<typeof CreateProjectRoute>,
) {
  const body = req.body;
  const gitProvider = body.gitProvider ?? "github";

  // Reuse an existing project for the same repo, regardless of which id
  // format created it (older rows may use `owner/repo`).
  const existing = await projectsStore.getProjectByOwnerRepo({
    gitProvider,
    providerOwner: body.providerOwner,
    repositoryName: body.repositoryName,
  });
  if (existing) {
    reply.code(201);
    return projectResponse(existing);
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

  // Demo trusts only the provider's real default branch, not client input.
  let defaultBranch = body.defaultBranch ?? "main";
  if (env.isDemoMode) {
    try {
      defaultBranch = await getGitProvider(
        gitProvider,
        await resolveGitToken(gitProvider),
      ).getDefaultBranch(body.providerOwner, body.repositoryName);
    } catch {
      // Keep the supplied/default branch if discovery fails.
    }
  }

  const byProviderId = await projectsStore.getProjectByProviderId({
    gitProvider,
    providerProjectId,
  });
  if (byProviderId) {
    const sameRepo =
      byProviderId.providerOwner.toLowerCase() ===
        body.providerOwner.toLowerCase() &&
      byProviderId.repositoryName.toLowerCase() ===
        body.repositoryName.toLowerCase();
    if (!sameRepo) {
      throw httpErrors.conflict(
        "Repository id already belongs to another project",
      );
    }
    reply.code(201);
    return projectResponse(byProviderId);
  }

  const { project } = await projectsStore.upsertProject({
    ...body,
    gitProvider,
    providerProjectId,
    defaultBranch,
  });
  reply.code(201);
  return projectResponse(project);
}

export async function prepareBranch(
  req: TypeBoxRequest<typeof PrepareBranchRoute>,
  _reply: TypeBoxReply<typeof PrepareBranchRoute>,
) {
  const { id } = req.params;
  const { branch } = req.body;
  return prepareProjectBranch(id, branch);
}

export const repositoryRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get("/projects", { schema: ListProjectsRoute }, listProjects);

  app.post(
    "/projects",
    {
      schema: CreateProjectRoute,
      preHandler: allowAddReposGuard("Adding repositories is disabled"),
    },
    createProject,
  );

  app.post(
    "/projects/:id/branches/prepare",
    { schema: PrepareBranchRoute },
    prepareBranch,
  );
};
