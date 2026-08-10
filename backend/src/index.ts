import "dotenv/config.js";
import { buildApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { startSyncWorker } from "@/projects/worker/sync-worker";

async function main() {
  const app = await buildApp();

  if (env.SYNC_WORKER_ENABLED) {
    startSyncWorker();
    logger.info({ event: "worker.start" }, "sync worker started");
  }

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
