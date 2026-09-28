import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config/env";
import * as schema from "@/db/schema";

const liveDb = drizzle(postgres(env.DATABASE_URL), { schema });

export const db = liveDb;

export type DbClient = typeof liveDb;

export type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type DbOrTx = DbClient | Tx;
