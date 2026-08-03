import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "@/config/env";

import { health } from "@/health/routes";
import { checkVerification } from "@/verification/routes";
import { listModels } from "@/models/routes";
import { listRepositories, listBranches, listCommits, countCommits } from "@/gitRepositories/routes";
import { createReport, listReports, getReport, getReportCommits, updateReport, replyToReport } from "@/reports/routes";
import { listProjects } from "@/projects/routes";
import { listKeys as listCredentials, addKey as addCredential, deleteKey as deleteCredential, verifyKey as verifyCredential } from "@/credentials/routes";

import { ErrorResponse } from "@/shared/typebox";
import { HealthResponse } from "@/health/schemas";
import { VerificationOkResponse } from "@/verification/schemas";
import { ModelsQuery, ModelsResponse } from "@/models/schemas";
import {
  RepoOwnerParams,
  CommitsQuery,
  CommitsResponse,
  CommitsCountQuery,
  CommitsCountResponse,
  RepositoriesQuery,
  RepositoriesResponse,
  BranchesResponse,
} from "@/gitRepositories/schemas";
import {
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
  ReportCommitsResponse,
} from "@/reports/schemas";
import { ProjectsResponse } from "@/projects/schemas";
import {
  AddCredentialBody,
  CredentialListResponse,
  CredentialCreatedResponse,
  VerifyCredentialBody,
  VerifyCredentialResponse,
} from "@/credentials/schemas";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });

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
      description: "List available AI models",
      tags: ["models"],
      querystring: ModelsQuery,
      response: { 200: ModelsResponse, 400: ErrorResponse },
    },
  }, listModels);

  app.get("/api/v1/repositories", {
    schema: {
      description: "List GitHub repositories for the authenticated user",
      tags: ["repositories"],
      querystring: RepositoriesQuery,
      response: { 200: RepositoriesResponse, 400: ErrorResponse, 500: ErrorResponse },
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
      response: { 200: ReportsListResponse, 400: ErrorResponse, 500: ErrorResponse },
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

  app.get("/api/v1/reports/:id/commits", {
    schema: {
      description: "List commits for a report, syncing new commits from GitHub",
      tags: ["reports"],
      params: ReportIdParams,
      response: { 200: ReportCommitsResponse, 404: ErrorResponse },
    },
  }, getReportCommits);

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

  app.get("/api/v1/projects", {
    schema: {
      description: "List synced GitHub projects",
      tags: ["projects"],
      response: { 200: ProjectsResponse, 500: ErrorResponse },
    },
  }, listProjects);

  app.get("/api/v1/credentials", {
    schema: {
      description: "List stored credentials (key hints only, no full keys returned)",
      tags: ["credentials"],
      response: { 200: CredentialListResponse, 400: ErrorResponse },
    },
  }, listCredentials);

  app.post("/api/v1/credentials", {
    schema: {
      description: "Store a new credential (API key encrypted at rest)",
      tags: ["credentials"],
      body: AddCredentialBody,
      response: { 201: CredentialCreatedResponse, 400: ErrorResponse },
    },
  }, addCredential);

  app.delete("/api/v1/credentials/:id", {
    schema: {
      description: "Delete a stored credential",
      tags: ["credentials"],
      params: ReportIdParams,
      response: { 204: {}, 404: ErrorResponse },
    },
  }, deleteCredential);

  app.post("/api/v1/credentials/verify", {
    schema: {
      description: "Verify an API key against its provider",
      tags: ["credentials"],
      body: VerifyCredentialBody,
      response: { 200: VerifyCredentialResponse, 400: ErrorResponse },
    },
  }, verifyCredential);

  return app;
}
