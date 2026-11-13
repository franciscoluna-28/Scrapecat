import { FastifyRequest, FastifyReply } from "fastify";
import { checkDatabase } from "@/api/system/services";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import { commitChunksStore } from "@/rag/indexing/commit-chunks-store";

export async function health(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: "ok" });
}

export async function ready(_req: FastifyRequest, reply: FastifyReply) {
  const ok = await checkDatabase();
  return ok
    ? reply.send({ status: "ok" })
    : reply.status(503).send({ status: "error" });
}

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
