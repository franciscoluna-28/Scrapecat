// Vercel entrypoint.
//
// Plain JavaScript on purpose: Vercel type-checks the entrypoint, and the
// generated bundle it imports (`dist/vercel-entry.mjs`) has no type
// declarations, which would fail with TS7016.
//
// Vercel's Fastify framework detector requires the entrypoint file itself to
// import `fastify`, so we create the instance here and hand it to the app
// factory. The factory comes from the esbuild bundle in `dist/` (built by
// `scripts/build-vercel.mjs`) because Vercel's Node runtime does not support the
// `@/` tsconfig path aliases used throughout `src/`.
import Fastify from "fastify";
import { buildVercelApp } from "./dist/vercel-entry.mjs";

async function main() {
  const app = await buildVercelApp(
    Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } }),
  );
  await app.listen({ port: Number(process.env.PORT ?? 4000) });
}

main();
