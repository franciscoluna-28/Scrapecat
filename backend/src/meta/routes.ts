import { FastifyRequest, FastifyReply } from "fastify";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";

export async function getMeta(_req: FastifyRequest, reply: FastifyReply) {
  const projects = await projectsStore.listProjects();

  const repos = await Promise.all(
    projects.map(async (p) => ({
      providerOwner: p.providerOwner,
      repositoryName: p.repositoryName,
      defaultBranch: p.defaultBranch,
      commitCount: await commitChunksStore.countChunksForProject({
        projectId: p.id,
      }),
    })),
  );

  return reply.send({
    datasetSource: "database" as const,
    seedVersion: null,
    generatedAt: null,
    repos,
  });
}
