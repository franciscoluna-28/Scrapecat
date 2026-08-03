import "dotenv/config.js";
import { buildApp } from "@/app";
import { env } from "@/config/env";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Backend running at http://${env.HOST}:${env.PORT}`);
    console.log(`API docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
