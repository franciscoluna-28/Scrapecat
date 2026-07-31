import { FastifyRequest, FastifyReply } from "fastify";
import { projectIdParamsSchema, projectCommitsQuerySchema } from "../schemas";
import * as projectsStore from "../db/stores/projects-store";
import * as commitChunksStore from "../db/stores/commit-chunks-store";

export async function listProjects(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const projects = await projectsStore.listProjects();
    return reply.send({
      projects: projects.map((p) => ({
        id: p.id,
        githubProjectId: p.githubProjectId,
        repositoryName: p.repositoryName,
        defaultBranch: p.defaultBranch,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error listing projects:", error);
    return reply.status(500).send({ error: "Failed to list projects" });
  }
}

export async function listProjectCommits(
  req: FastifyRequest<{ Params: { projectId: string }; Querystring: { startDate?: string; endDate?: string } }>,
  reply: FastifyReply,
) {
  const params = projectIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  const query = projectCommitsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return reply.status(400).send({ error: query.error.flatten() });
  }

  try {
    const commits = await commitChunksStore.listCommitsForProject(params.data.projectId, {
      startDate: query.data.startDate ? new Date(query.data.startDate) : undefined,
      endDate: query.data.endDate ? new Date(query.data.endDate) : undefined,
    });
    return reply.send({
      commits: commits.map((c) => ({
        id: c.id,
        commitSha: c.commitSha,
        commitMessage: c.commitMessage,
        author: c.author,
        diffSummary: c.diffSummary,
        committedAt: c.committedAt,
        metadata: c.metadata,
      })),
    });
  } catch (error) {
    console.error("Error listing project commits:", error);
    return reply.status(500).send({ error: "Failed to list commits" });
  }
}
