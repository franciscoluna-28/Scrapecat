import helmet from "@fastify/helmet";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyTypeBox } from "@/shared/fastify";
import { systemRoutes } from "@/api/system/routes";
import { credentialRoutes } from "@/api/credentials/routes";
import { gitConnectionRoutes } from "@/api/credentials/git-connection-routes";
import { discoveryRoutes } from "@/api/repositories/discovery";
import { repositoryRoutes } from "@/api/repositories/routes";
import { settingsRoutes } from "@/api/settings/routes";
import { chatRoutes } from "@/api/chat/routes";
import { reportRoutes } from "@/api/reports/routes";

/**
 * All HTTP routes live under `/api/v1`. Each domain exports a typed Fastify
 * plugin that owns its routes, schemas, and guards; this module only composes
 * them and applies the API-scoped security headers (helmet is intentionally not
 * global so the Swagger UI at `/docs` is unaffected).
 */
const apiV1: FastifyPluginAsyncTypebox = async (api) => {
  await api.register(helmet);
  await api.register(systemRoutes);
  await api.register(credentialRoutes);
  await api.register(gitConnectionRoutes);
  await api.register(discoveryRoutes);
  await api.register(repositoryRoutes);
  await api.register(settingsRoutes);
  await api.register(chatRoutes);
  await api.register(reportRoutes);
};

export async function registerRoutes(app: FastifyTypeBox) {
  await app.register(apiV1, { prefix: "/api/v1" });
}
