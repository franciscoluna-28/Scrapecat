import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgres://scrapecat:scrapecat@localhost:5432/scrapecat"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("mimo-v2.6-flash"),
  DEEPSEEK_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_API_KEY: z.string().default("ollama"),
  GITHUB_TOKEN: z.string().default(""),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  ENCRYPTION_KEY: z.string().default(""),
  // Postgres connection pool size. Serverless hosts (Vercel) should use a
  // pooled connection string and set this to 1 to avoid exhausting connections.
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  // Set to "false" when the connection goes through a transaction-mode pooler
  // (Neon/Supabase) that does not support prepared statements.
  DATABASE_PREPARE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  EMBEDDING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  DEMO_RESTRICT_KEYS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Demo profile: ingest commits via the GitHub REST API (Octokit) instead of
  // a local `git` archive, and never touch user-scoped GitHub endpoints. This
  // is what makes the demo runnable on serverless hosts without a git binary
  // or persistent disk. Storage is still PostgreSQL — this only changes how
  // commits are read and which GitHub endpoints are allowed.
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Whether new repositories may be connected. Default true. Set to "false"
  // to lock the app to the repos already ingested — e.g. for the hackathon
  // demo, after you have connected + ingested the repos you want to ship.
  ALLOW_ADD_REPOS: z
    .enum(["true", "false"])
    .default("true")
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

if (!parsed.data.ENCRYPTION_KEY) {
  console.error(
    "ENCRYPTION_KEY is required (use: openssl rand -base64 32)",
  );
  process.exit(1);
}

const missing: string[] = [];
if (!parsed.data.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
// Demo reads public repos anonymously (60 req/hr). A token just raises the
// limit, so it is not required there.
if (!parsed.data.GITHUB_TOKEN && !parsed.data.DEMO_MODE) missing.push("GITHUB_TOKEN");
if (missing.length > 0) {
  console.warn(`Warning: missing environment variables — ${missing.join(", ")}`);
}

const isDemoMode = parsed.data.DEMO_MODE;

// Vercel sets VERCEL=1 on both builds and runtime. Used to skip Node-only
// features (e.g. the Swagger UI static asset server) in serverless deployments.
const isVercel = !!process.env.VERCEL;

// CORS_ORIGIN may list several origins separated by commas (e.g. a production
// domain plus Vercel preview URLs).
const corsOrigins = parsed.data.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...parsed.data,
  isDemoMode,
  // Demo mode restricts BYOK — there is no per-visitor key store.
  isDemoRestrictKeys: parsed.data.DEMO_RESTRICT_KEYS || isDemoMode,
  // Configurable independently of demo mode: enable to seed repos, disable to
  // lock the app to the pre-ingested set.
  allowAddRepos: parsed.data.ALLOW_ADD_REPOS,
  isVercel,
  corsOrigins,
};