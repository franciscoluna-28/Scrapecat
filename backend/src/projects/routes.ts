import { FastifyRequest, FastifyReply } from "fastify";
import * as projectsStore from "@/projects/stores/projects-store";

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
