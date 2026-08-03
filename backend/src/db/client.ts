import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config/env";
import * as schema from "@/db/schema";

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

export type DbClient = typeof db;

export type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type DbOrTx = DbClient | Tx;