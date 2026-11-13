import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/shared/config/env";
import * as schema from "@/db/schema";

const sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_MAX,
  prepare: env.DATABASE_PREPARE,
});

const liveDb = drizzle(sql, { schema });

export const db = liveDb;

/**
 * Close the underlying pool so one-shot scripts can exit. The dev server keeps
 * the pool open for its lifetime and never calls this.
 */
export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export type DbClient = typeof liveDb;

export type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type DbOrTx = DbClient | Tx;
