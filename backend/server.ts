// Vercel entrypoint. Vercel detects a root `server.ts` as a Fastify app and
// captures the `app.listen()` call made by the bundled module below.
//
// The bundle is produced by `scripts/build-vercel.mjs` (run automatically via
// the `vercel-build` script) and resolves the `@/` path aliases, which Vercel's
// Node runtime does not support. This file is intentionally outside `src/` so
// `tsc` does not try to resolve the generated output.
import "./dist/vercel-entry.mjs";
