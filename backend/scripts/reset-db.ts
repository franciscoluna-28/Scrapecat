/**
 * Scrapecat depends a lot on greenfield databases to test workers and
 * generation scripts, so we need to reset the DB from time to time.
 *
 * Destructive: drops the whole schema and re-applies migrations.
 * Never allowed to run in production.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset the database in production.");
  process.exit(1);
}

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://scrapecat:scrapecat@localhost:5432/scrapecat";

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    console.log("Dropping the vector extension, drizzle journal, and public schema...");
    await sql`drop extension if exists vector cascade`;
    // Drizzle keeps its migration journal in a dedicated `drizzle` schema —
    // it must be dropped too, or migrate() thinks everything is already applied.
    await sql`drop schema if exists drizzle cascade`;
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;

    console.log("Re-applying migrations...");
    await migrate(drizzle(sql), { migrationsFolder: "./src/db/migrations" });

    console.log("Database reset complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
