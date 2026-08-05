import { FastifyRequest, FastifyReply } from "fastify";
import * as projectsStore from "@/projects/stores/projects-store";
import { getSyncStatus } from "@/projects/sync-service";
import {
  projectIdParamsSchema,
  syncStatusQuerySchema,
} from "@/projects/schemas";

export async function listProjects(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const projects = await projectsStore.listProjects();
    return reply.send({
      projects: projects.map((p) => ({
        id: p.id,
        githubProjectId: p.githubProjectId,
        githubOwner: p.githubOwner,
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

export async function getProjectSyncStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const params = projectIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }
  const query = syncStatusQuerySchema.safeParse(req.query);
  if (!query.success) {
    return reply.status(400).send({ error: query.error.flatten() });
  }

  try {
    const status = await getSyncStatus({
      projectId: params.data.id,
      branch: query.data.branch ?? "main",
    });
    return reply.send(status);
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return reply.status(500).send({ error: "Failed to fetch sync status" });
  }
}
