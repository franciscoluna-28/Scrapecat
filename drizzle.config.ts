import type { Config } from "drizzle-kit";

export default {
  schema: "./src/drizzle/schema.ts",
  out: "./src/drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./dev.db",
  },
} satisfies Config;
