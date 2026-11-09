import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tempDir = mkdtempSync(join(tmpdir(), "scrapecat-openapi-"));
const specPath = join(tempDir, "openapi.json");
const encryptionKey =
  process.env.ENCRYPTION_KEY || Buffer.alloc(32).toString("base64");

try {
  console.log("Generating OpenAPI spec...");
  execSync(
    `pnpm --filter @scrapecat/backend exec tsx scripts/generate-openapi.ts "${specPath}"`,
    {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, ENCRYPTION_KEY: encryptionKey },
    },
  );

  console.log("Generating types...");
  execSync(
    `pnpm --filter frontend exec openapi-typescript "${specPath}" -o ./src/shared/api/types.ts`,
    { stdio: "inherit", cwd: process.cwd() },
  );

  console.log("Types generated successfully.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
