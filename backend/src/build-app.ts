import type { FastifyTypeBox } from "@/shared/fastify";
import { createServer } from "@/startup/create-server";
import { registerRoutes } from "@/startup/register-routes";

/**
 * Public factory used by `main.ts`, the Vercel entrypoint, and tests.
 * Server composition and route registration are split so feature work does not
 * have to edit Fastify setup or unrelated route groups.
 */
export async function buildApp(instance?: FastifyTypeBox) {
  const app = await createServer(instance);
  await registerRoutes(app);
  return app;
}
