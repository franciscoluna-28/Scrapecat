import "dotenv/config.js";
import { buildApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { seedDemoData } from "@/demo/seed";
import { embedDemoChunks } from "@/db/memory";

async function main() {
  // Demo / stateless deployments (no DATABASE_URL) pre-load bundled repos into
  // the in-memory store. This is fully opt-in via env vars — the open-source
  // Postgres path never reaches here.
  if (env.isInMemoryMode || env.isDemoMode) {
    const seeded = await seedDemoData();
    if (seeded.chunks > 0) {
      const embedded = await embedDemoChunks();
      logger.info(
        { chunks: seeded.chunks, embedded: embedded.embedded },
        "demo chunks embedded at startup",
      );
    }
    logger.info(
      { demoMode: env.isDemoMode, inMemory: env.isInMemoryMode },
      "running in stateless demo mode (no database)",
    );
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(
      { host: env.HOST, port: env.PORT },
      `backend running at http://${env.HOST}:${env.PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
