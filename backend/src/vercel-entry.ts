import type { FastifyTypeBox } from "@/shared/fastify";
import { buildApp } from "@/build-app";

/**
 * Builds the Fastify app for the Vercel serverless entry. Exported rather than
 * auto-started: the root `server.ts` (the file Vercel detects) imports `fastify`
 * and owns the `listen()` call. This module is bundled by
 * `scripts/build-vercel.mjs`, which resolves the `@/` path aliases Vercel's Node
 * runtime does not support.
 */
export function buildVercelApp(
  instance?: FastifyTypeBox,
): Promise<FastifyTypeBox> {
  return buildApp(instance);
}
