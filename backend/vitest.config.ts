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
      ENCRYPTION_KEY: "test-only-key-0123456789abcdef0123456789abcdef",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/scrapecat_test",
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
