export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "google/gemma-4-26b-a4b-it:free",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_ENDPOINT: process.env.R2_ENDPOINT || "",
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
};
