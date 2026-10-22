import type { FastifyInstance } from "fastify";
import { createServer } from "@/app/create-server";
import { registerRoutes } from "@/app/register-routes";

/**
 * Public factory used by `main.ts`, the Vercel entrypoint, and tests.
 * Server composition and route registration are split so feature work does not
 * have to edit Fastify setup or unrelated route groups.
 */
export async function buildApp(instance?: FastifyInstance) {
  const app = await createServer(instance);
  registerRoutes(app);
  return app;
}
