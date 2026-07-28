import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("google/gemma-4-26b-a4b-it:free"),
  GITHUB_TOKEN: z.string().default(""),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  ENCRYPTION_KEY: z.string().default(""),
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
if (!parsed.data.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
if (missing.length > 0) {
  console.warn(`Warning: missing environment variables — ${missing.join(", ")}`);
}

export const env = parsed.data;
