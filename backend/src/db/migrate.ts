import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://scrapecat:scrapecat@localhost:5432/scrapecat";

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Migrations applied successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
