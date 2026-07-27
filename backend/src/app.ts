import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env";

import { health } from "./routes/health";
import { listCommits, countCommits } from "./routes/commits";
import { listRepositories } from "./routes/repositories";
import { listBranches } from "./routes/branches";
import { checkVerification } from "./routes/verification";
import { listModels } from "./routes/models";
import { createReport } from "./routes/generate-report";
import { listReports, getReport, updateReport } from "./routes/reports";
import { replyToReport } from "./routes/reply";

import {
  ErrorResponse,
  HealthResponse,
  RepoOwnerParams,
  CommitsQuery,
  CommitsResponse,
  CommitsCountQuery,
  CommitsCountResponse,
  RepositoriesQuery,
  RepositoriesResponse,
  BranchesResponse,
  VerificationOkResponse,
  ModelsResponse,
  ReportInputBody,
  ReportCreatedResponse,
  ReportFallbackResponse,
  ReportsListQuery,
  ReportsListResponse,
  ReportIdParams,
  ReportGetResponse,
  ReportUpdateBody,
  ReportUpdateResponse,
  ReportReplyBody,
  ReportReplyResponse,
} from "./schemas/json";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Scrapecat API",
        version: "v1",
        description: "Backend API for Scrapecat reports",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.get("/api/v1/health", {
    schema: {
      description: "Health check endpoint",
      tags: ["health"],
      response: { 200: HealthResponse },
    },
  }, health);

  app.get("/api/v1/verification/status", {
    schema: {
      description: "Verify GitHub token connection status",
      tags: ["verification"],
      response: { 200: VerificationOkResponse },
    },
  }, checkVerification);

  app.get("/api/v1/models", {
    schema: {
      description: "List available AI models from OpenRouter",
      tags: ["models"],
      response: { 200: ModelsResponse },
    },
  }, listModels);

  app.get("/api/v1/repositories", {
    schema: {
      description: "List GitHub repositories for the authenticated user",
      tags: ["repositories"],
      querystring: RepositoriesQuery,
      response: { 200: RepositoriesResponse },
    },
  }, listRepositories);

  app.get("/api/v1/repositories/:owner/:repo/branches", {
    schema: {
      description: "List branches for a repository",
      tags: ["repositories"],
      params: RepoOwnerParams,
      response: { 200: BranchesResponse, 400: ErrorResponse },
    },
  }, listBranches);

  app.get("/api/v1/repositories/:owner/:repo/commits", {
    schema: {
      description: "List commits for a repository within an optional date range",
      tags: ["repositories"],
      params: RepoOwnerParams,
      querystring: CommitsQuery,
      response: { 200: CommitsResponse, 400: ErrorResponse },
    },
  }, listCommits);

  app.get("/api/v1/repositories/:owner/:repo/commits/count", {
    schema: {
      description: "Count commits for a repository within an optional date range",
      tags: ["repositories"],
      params: RepoOwnerParams,
      querystring: CommitsCountQuery,
      response: { 200: CommitsCountResponse, 400: ErrorResponse },
    },
  }, countCommits);

  app.post("/api/v1/reports", {
    schema: {
      description: "Generate a new report from commits",
      tags: ["reports"],
      body: ReportInputBody,
      response: { 201: ReportCreatedResponse, 400: ErrorResponse, 429: ReportFallbackResponse },
    },
  }, createReport);

  app.get("/api/v1/reports", {
    schema: {
      description: "List all generated reports, optionally filtered by project",
      tags: ["reports"],
      querystring: ReportsListQuery,
      response: { 200: ReportsListResponse },
    },
  }, listReports);

  app.get("/api/v1/reports/:id", {
    schema: {
      description: "Get a single report by ID",
      tags: ["reports"],
      params: ReportIdParams,
      response: { 200: ReportGetResponse, 404: ErrorResponse },
    },
  }, getReport);

  app.put("/api/v1/reports/:id", {
    schema: {
      description: "Update a report's editable markdown content",
      tags: ["reports"],
      params: ReportIdParams,
      body: ReportUpdateBody,
      response: { 200: ReportUpdateResponse, 400: ErrorResponse, 404: ErrorResponse },
    },
  }, updateReport);

  app.post("/api/v1/reports/:id/replies", {
    schema: {
      description: "Send a follow-up instruction to refine a report",
      tags: ["reports"],
      params: ReportIdParams,
      body: ReportReplyBody,
      response: { 200: ReportReplyResponse, 400: ErrorResponse, 404: ErrorResponse, 429: ErrorResponse },
    },
  }, replyToReport);

  return app;
}
