import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env";

import { health } from "./routes/health";
import { listCommits, countCommits } from "./routes/commits";
import { listRepositories } from "./routes/repositories";
import { listBranches } from "./routes/branches";
import { verifyConnection } from "./routes/verify";
import { listModels } from "./routes/ai-models";
import { generateReport } from "./routes/generate-report";
import { listReports, getReport, updateReport } from "./routes/reports";
import { replyToReport } from "./routes/reply";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Fabric API",
        version: "0.1.0",
        description: "Backend API for Fabric reports",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.get("/health", health);

  app.get("/api/commits", listCommits);
  app.get("/api/commits/count", countCommits);

  app.get("/api/repositories", listRepositories);
  app.get("/api/branches", listBranches);
  app.get("/api/verify", verifyConnection);

  app.get("/api/ai/models", listModels);

  app.post("/api/generate-report", generateReport);

  app.get("/api/reports", listReports);
  app.get("/api/reports/:id", getReport);
  app.put("/api/reports/:id", updateReport);
  app.post("/api/reports/:id/reply", replyToReport);

  return app;
}
