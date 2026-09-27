import { env } from "@/config/env";
import * as memory from "@/db/memory";
import { logger } from "@/shared/logger";

import formbricksData from "./data/formbricks__formbricks.json";
import shadcnuiData from "./data/shadcn-ui__ui.json";

const SNAPSHOTS = [
  formbricksData,
  shadcnuiData,
] as memory.DemoSnapshot[];

// Bump when the bundled dataset changes meaningfully (new repos, new builder
// defaults). Exposed via GET /api/v1/meta so anyone poking the API can see the
// demo data is a controlled, versioned snapshot rather than live magic.
export const DEMO_DATASET_VERSION = "1.0.0";

let datasetGeneratedAt: string | null = null;

export function getDemoDatasetMeta() {
  return {
    seedVersion: DEMO_DATASET_VERSION,
    generatedAt: datasetGeneratedAt,
  };
}

/**
 * Seeds the bundled demo repositories into the in-memory store at boot. Only
 * active in demo/stateless deployments (no DATABASE_URL); the open-source
 * Postgres path never calls this.
 */
export async function seedDemoData(): Promise<{ projects: number; chunks: number }> {
  if (!env.isDemoMode && !env.isInMemoryMode) {
    return { projects: 0, chunks: 0 };
  }

  const start = performance.now();
  let projects = 0;
  let chunks = 0;

  for (const snapshot of SNAPSHOTS) {
    if (!snapshot || !snapshot.repo || !snapshot.owner || !Array.isArray(snapshot.commits)) {
      continue;
    }
    const seeded = memory.seedDemoSnapshot(snapshot);
    projects += 1;
    chunks += seeded.chunks;
  }
  if (projects > 0 && !datasetGeneratedAt) {
    datasetGeneratedAt = new Date().toISOString();
  }

  logger.info(
    { projects, chunks, durationMs: Math.round(performance.now() - start) },
    "demo repos seeded into in-memory store",
  );
  return { projects, chunks };
}