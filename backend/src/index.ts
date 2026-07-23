import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

async function main() {
  try {
    await app.listen({ port: 4000, host: "0.0.0.0" });
    console.log("Backend running at http://localhost:4000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
