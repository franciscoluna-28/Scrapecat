import { spawn, execSync } from "child_process";
import http from "http";

const OPENAPI_JSON_URL = "http://localhost:4000/docs/json";

function waitForServer(url: string, maxRetries = 15): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      retries++;
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else if (retries < maxRetries) setTimeout(check, 500);
          else reject(new Error("Server did not start"));
        })
        .on("error", () => {
          if (retries < maxRetries) setTimeout(check, 500);
          else reject(new Error("Server did not start"));
        });
    };
    check();
  });
}

async function main() {
  console.log("Starting backend...");
  const backend = spawn("pnpm", ["--filter", "backend", "dev"], {
    stdio: "ignore",
    shell: true,
    env: { ...process.env, PORT: "4000" },
  });

  try {
    await waitForServer(OPENAPI_JSON_URL);
    console.log("Backend is ready. Generating types...");
    execSync(
      "pnpm --filter frontend exec openapi-typescript http://localhost:4000/docs/json -o ./src/shared/api/types.ts",
      { stdio: "inherit", cwd: process.cwd() },
    );
    console.log("Types generated successfully.");
  } catch (err) {
    console.error("Failed to generate types:", err);
    process.exit(1);
  } finally {
    backend.kill();
    process.exit(0);
  }
}

main();
