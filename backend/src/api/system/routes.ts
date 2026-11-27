import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { checkDatabase } from "@/api/system/services";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import { commitEmbeddingsStore } from "@/rag/indexing/commit-embeddings-store";
import {
  HealthReadyRoute,
  HealthRoute,
  MetaRoute,
} from "@/api/system/schemas";

export async function health(
  _req: TypeBoxRequest<typeof HealthRoute>,
  _reply: TypeBoxReply<typeof HealthRoute>,
) {
  return { status: "ok" as const };
}

export async function ready(
  _req: TypeBoxRequest<typeof HealthReadyRoute>,
  reply: TypeBoxReply<typeof HealthReadyRoute>,
) {
  const ok = await checkDatabase();
  if (!ok) {
    reply.code(503);
    return { status: "error" as const };
  }
  return { status: "ok" as const };
}

export async function getMeta(
  _req: TypeBoxRequest<typeof MetaRoute>,
  _reply: TypeBoxReply<typeof MetaRoute>,
) {
  const projects = await projectsStore.listProjects();

  const repos = await Promise.all(
    projects.map(async (p) => ({
      providerOwner: p.providerOwner,
      repositoryName: p.repositoryName,
      defaultBranch: p.defaultBranch,
      commitCount: await commitEmbeddingsStore.countCommitsForProject({
        repoId: p.id,
      }),
    })),
  );

  return {
    datasetSource: "database" as const,
    seedVersion: null,
    generatedAt: null,
    repos,
  };
}

export const systemRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get("/health", { schema: HealthRoute }, health);
  app.get("/health/ready", { schema: HealthReadyRoute }, ready);
  app.get("/meta", { schema: MetaRoute }, getMeta);
};
