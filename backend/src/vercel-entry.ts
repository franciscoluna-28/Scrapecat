import { buildApp } from "@/build-app";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

/**
 * Vercel serverless entry. Never imported by the Node/dev runtime — Vercel
 * bundles this file (via `scripts/build-vercel.mjs`) into `dist/vercel-entry.mjs`
 * and runs it through the root `server.ts` import.
 *
 * Vercel injects env vars directly, so there is no `dotenv` import here.
 * `app.listen()` is what Vercel captures to route requests into Fastify.
 */
async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT });
  logger.info({ port: env.PORT }, "backend listening (vercel)");
}

main();
