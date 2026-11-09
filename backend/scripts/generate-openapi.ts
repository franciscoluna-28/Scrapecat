import "dotenv/config.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildApp } from "@/build-app";

async function main() {
  const output = resolve(process.argv[2] ?? ".openapi.json");
  const app = await buildApp();

  try {
    await app.ready();
    const spec = (
      app as unknown as { swagger: () => Record<string, unknown> }
    ).swagger();
    await writeFile(output, JSON.stringify(spec, null, 2));
    console.log(`OpenAPI spec written to ${output}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
