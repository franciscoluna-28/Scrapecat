import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DB_INTEGRATION: "1",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://scrapecat:scrapecat@localhost:5432/scrapecat",
      ENCRYPTION_KEY: "test-only-key-0123456789abcdef0123456789abcdef",
      OPENROUTER_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      GITHUB_TOKEN: "",
      HOST: "localhost",
      PORT: "4000",
      CORS_ORIGIN: "*",
    },
  },
});
