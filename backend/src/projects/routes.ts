import { FastifyRequest, FastifyReply } from "fastify";
import * as projectsStore from "@/projects/stores/projects-store";
import { prepareProjectBranch } from "@/projects/services";
import { PrepareBranchBody, ProjectIdParams } from "@/projects/schemas";
import type { Static } from "@sinclair/typebox";

export async function listProjects(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const projects = await projectsStore.listProjects();
    const indexedBranches = await Promise.all(
      projects.map((project) => projectsStore.listIndexedBranches(project.id)),
    );
    return reply.send({
      projects: projects.map((p, index) => ({
        id: p.id,
        gitProvider: p.gitProvider,
        providerProjectId: p.providerProjectId,
        providerOwner: p.providerOwner,
        repositoryName: p.repositoryName,
        defaultBranch: p.defaultBranch,
        indexedBranches: indexedBranches[index],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error listing projects:", error);
    return reply.status(500).send({ error: "Failed to list projects" });
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
