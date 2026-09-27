import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config/env";
import * as schema from "@/db/schema";

// In-memory mode (no DATABASE_URL / DEMO_MODE) never creates a postgres
// client — imports of this module are side-effect free and do not connect.
const liveDb = env.isInMemoryMode
  ? null
  : drizzle(postgres(env.DATABASE_URL), { schema });

export const db = liveDb as NonNullable<typeof liveDb>;

export type DbClient = NonNullable<typeof liveDb>;

export type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type DbOrTx = DbClient | Tx;

export const isInMemoryMode = env.isInMemoryMode;
export const isDemoMode = env.isDemoMode;

export function getDb(): DbClient {
  if (!liveDb) {
    throw new Error("Database not configured (running without DATABASE_URL)");
  }
  return liveDb;
}