import { spawn, execSync } from "child_process";
import http from "http";

const OPENAPI_JSON_URL = "http://localhost:4000/docs/json";

function waitForServer(url: string, maxRetries = 60): Promise<void> {
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
  const backend = spawn("pnpm", ["--filter", "@scrapecat/backend", "dev"], {
    stdio: "ignore",
    shell: true,
    env: { ...process.env, PORT: "4000" },
  });

  const stopBackend = () => {
    if (!backend.pid) return;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${backend.pid} /T /F`, { stdio: "ignore" });
      } else {
        backend.kill();
      }
    } catch {
      // already stopped
    }
  };

  let exitCode = 0;
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
    exitCode = 1;
  } finally {
    stopBackend();
    process.exit(exitCode);
  }
}

main();
