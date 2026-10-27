import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function bundle(entry, outfile) {
  return build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(root, outfile),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    sourcemap: true,
    logLevel: "info",
    packages: "external",
    tsconfig: path.join(root, "tsconfig.json"),
  });
}

await Promise.all([
  bundle("src/main.ts", "dist/main.mjs"),
  bundle("src/db/migrate.ts", "dist/migrate.mjs"),
]);
