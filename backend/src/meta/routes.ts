import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { getDemoDatasetMeta } from "@/demo/seed";

/**
 * Describes where the data backing the API comes from and how it was loaded.
 * In demo deployments the repos are a bundled, versioned snapshot (loaded into
 * the in-memory store at boot). Otherwise they are read live from the database.
 */
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

  const dataset = env.isDemoMode ? getDemoDatasetMeta() : { seedVersion: null, generatedAt: null };

  return reply.send({
    datasetSource: env.isDemoMode ? ("bundled" as const) : ("database" as const),
    seedVersion: dataset.seedVersion,
    generatedAt: dataset.generatedAt,
    repos,
  });
}