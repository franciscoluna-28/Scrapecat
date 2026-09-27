import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgres://scrapecat:scrapecat@localhost:5432/scrapecat"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("mimo-v2.6-flash"),
  DEMO_AI_MODEL: z.string().default("stealth/space-bunny-alpha"),
  DEEPSEEK_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  GITHUB_TOKEN: z.string().default(""),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  ENCRYPTION_KEY: z.string().default(""),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  EMBEDDING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Per-IP request limits. Tighten these on shared/public deployments so a
  // visitor can't burn through AI credits. Set to large values to disable.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(240),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  REPO_ARCHIVE_DIR: z.string().default("repos"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

// Demo mode is fully opt-in via env vars. Nothing here changes the default
// open-source behavior (Postgres + BYOK + embeddings): that stays intact
// unless DATABASE_URL is explicitly empty and/or DEMO_MODE=true.
const isDemoMode = parsed.data.DEMO_MODE;
const isInMemoryMode = parsed.data.DATABASE_URL.trim() === "" || isDemoMode;

if (!isInMemoryMode && !parsed.data.ENCRYPTION_KEY) {
  console.error(
    "ENCRYPTION_KEY is required when using a database (use: openssl rand -base64 32)",
  );
  process.exit(1);
}

const missing: string[] = [];
if (!parsed.data.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
if (!parsed.data.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
if (missing.length > 0) {
  console.warn(`Warning: missing environment variables — ${missing.join(", ")}`);
}

export const env = {
  ...parsed.data,
  isDemoMode,
  isInMemoryMode,
};