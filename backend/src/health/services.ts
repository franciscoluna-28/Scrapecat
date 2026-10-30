import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { logger } from "@/shared/logger";

export async function checkDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (error) {
    logger.warn({ err: (error as Error).message }, "readiness: database check failed");
    return false;
  }
}
