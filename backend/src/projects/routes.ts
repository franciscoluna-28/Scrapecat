import { FastifyRequest, FastifyReply } from "fastify";
import * as projectsStore from "@/projects/stores/projects-store";
import { getSyncStatus } from "@/projects/sync-service";
import type { Static } from "@sinclair/typebox";
import { ProjectIdParams, SyncStatusQuery } from "@/projects/schemas";

export async function listProjects(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const projects = await projectsStore.listProjects();
    return reply.send({
      projects: projects.map((p) => ({
        id: p.id,
        gitProvider: p.gitProvider,
        providerProjectId: p.providerProjectId,
        providerOwner: p.providerOwner,
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
  const { id } = req.params as Static<typeof ProjectIdParams>;
  const { branch } = req.query as Static<typeof SyncStatusQuery>;

  try {
    const status = await getSyncStatus({
      projectId: id,
      branch: branch ?? "main",
    });
    return reply.send(status);
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return reply.status(500).send({ error: "Failed to fetch sync status" });
  }
}
