import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgres://scrapecat:scrapecat@localhost:5432/scrapecat"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("nvidia/nemotron-3-ultra-550b-a55b:free"),
  DEEPSEEK_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  GITHUB_TOKEN: z.string().default(""),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required (use: openssl rand -base64 32)"),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_ENDPOINT: z.string().default(""),
  R2_BUCKET_NAME: z.string().default(""),
  R2_PUBLIC_URL: z.string().default(""),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const missing: string[] = [];
if (!parsed.data.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
if (!parsed.data.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
if (missing.length > 0) {
  console.warn(`Warning: missing environment variables — ${missing.join(", ")}`);
}

export const env = parsed.data;
