import Fastify from "fastify";
import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "@/config/env";
import { sweepStaleJobScratch } from "@/repositories/archive-service";
import { shutdownJobQueue } from "@/shared/queue";

import { health } from "@/health/routes";
import { checkVerification } from "@/verification/routes";
import { getMeta } from "@/meta/routes";
import { listModels } from "@/models/routes";
import { listRepositories, listBranches, listCommits, countCommits } from "@/gitRepositories/routes";
import { listProjects, prepareBranch } from "@/projects/routes";
import { createProject as createProjectRoute } from "@/projects/routes";
import { PrepareBranchBody, PrepareBranchResponse, ProjectIdParams, CreateProjectBody, CreateProjectResponse } from "@/projects/schemas";
import { listKeys as listCredentials, addKey as addCredential, deleteKey as deleteCredential, verifyKey as verifyCredential } from "@/credentials/routes";
import { getSettingsRoute, updateSettingsRoute } from "@/settings/routes";
import {
  createGitHubToken,
  getGitHubConnection,
  deleteGitHubConnection,
} from "@/github/routes";
import {
  createSession as createChatSession,
  listSessions as listChatSessions,
  getMessages as getChatMessages,
  removeSession as deleteChatSession,
  streamMessage as streamChatMessage,
} from "@/chat/routes";

import { ErrorResponse } from "@/shared/typebox";
import {
  CreateSessionBody,
  CreateSessionResponse,
  ChatSessionsQuery,
  ChatSessionsListResponse,
  ChatSessionIdParams,
  ChatMessagesResponse,
  SendMessageBody,
  DeleteSessionResponse,
} from "@/chat/schemas";
import { HealthResponse } from "@/health/schemas";
import { MetaResponse } from "@/meta/schemas";
import { VerificationStatusResponse } from "@/verification/schemas";
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
import { ProjectsResponse } from "@/projects/schemas";
import {
  AddCredentialBody,
  CredentialListResponse,
  CredentialCreatedResponse,
  CredentialIdParams,
  VerifyCredentialBody,
  VerifyCredentialResponse,
} from "@/credentials/schemas";
import { AISettingsBody, AISettingsGetResponse } from "@/settings/schemas";
import { GitHubConnectionResponse, AddGitHubTokenBody } from "@/github/schemas";

export async function buildApp(instance?: FastifyInstance) {
  const app = instance ?? Fastify({ logger: { level: env.LOG_LEVEL } });

  // s3 mode treats local scratch as disposable: clear any dirs a crashed
  // worker left behind, and release queue resources on shutdown.
  await sweepStaleJobScratch();
  app.addHook("onClose", async () => {
    await shutdownJobQueue();
  });

  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: "Invalid request parameters" });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.message || "Internal Server Error",
    });
  });

  await app.register(cors, {
    // A single origin, or several comma-separated ones from CORS_ORIGIN.
    origin: env.corsOrigins.length <= 1 ? env.corsOrigins[0] ?? false : env.corsOrigins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Scrapecat API",
        version: "v1",
        description: "Backend API for Scrapecat RAG chat over git history",
      },
    },
  });

  // The Swagger UI serves static assets from disk, which serverless runtimes
  // (Vercel) don't provide. The OpenAPI JSON is still published.
  if (!env.isVercel) {
    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  app.get("/api/v1/health", {
    schema: {
      description: "Health check endpoint",
      tags: ["health"],
      response: { 200: HealthResponse },
    },
  }, health);

  app.get("/api/v1/meta", {
    schema: {
      description: "Describe the data backing the API (bundled demo dataset vs database)",
      tags: ["meta"],
      response: { 200: MetaResponse, 500: ErrorResponse },
    },
  }, getMeta);

  app.get("/api/v1/verification/status", {
    schema: {
      description: "Verify GitHub token connection status",
      tags: ["verification"],
      response: { 200: VerificationStatusResponse },
    },
  }, checkVerification);

  app.post("/api/v1/github/token", {
    schema: {
      description: "Store a GitHub Personal Access Token (connect GitHub account)",
      tags: ["github"],
      body: AddGitHubTokenBody,
      response: { 201: GitHubConnectionResponse, 400: ErrorResponse },
    },
  }, createGitHubToken);

  app.get("/api/v1/github/connection", {
    schema: {
      description: "GitHub connection status (stored token / env token / none)",
      tags: ["github"],
      response: { 200: GitHubConnectionResponse, 400: ErrorResponse },
    },
  }, getGitHubConnection);

  app.delete("/api/v1/github/connection", {
    schema: {
      description: "Disconnect GitHub (removes stored token)",
      tags: ["github"],
      response: { 204: {}, 404: ErrorResponse },
    },
  }, deleteGitHubConnection);

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

  app.get("/api/v1/projects", {
    schema: {
      description: "List synced GitHub projects",
      tags: ["projects"],
      response: { 200: ProjectsResponse, 500: ErrorResponse },
    },
  }, listProjects);

  app.post("/api/v1/projects", {
    schema: {
      description: "Create or connect a new project",
      tags: ["projects"],
      body: CreateProjectBody,
      response: { 201: CreateProjectResponse, 500: ErrorResponse },
    },
  }, createProjectRoute);

  app.post("/api/v1/projects/:id/branches/prepare", {
    schema: {
      description: "Ingest a project branch before chat retrieval",
      tags: ["projects"],
      params: ProjectIdParams,
      body: PrepareBranchBody,
      response: { 200: PrepareBranchResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, prepareBranch);

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
      params: CredentialIdParams,
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

  app.get("/api/v1/settings/ai", {
    schema: {
      description: "Get global AI model settings",
      tags: ["settings"],
      response: { 200: AISettingsGetResponse, 500: ErrorResponse },
    },
  }, getSettingsRoute);

  app.put("/api/v1/settings/ai", {
    schema: {
      description: "Update global AI model settings",
      tags: ["settings"],
      body: AISettingsBody,
      response: { 200: AISettingsGetResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, updateSettingsRoute);

  app.post("/api/v1/chat/sessions", {
    schema: {
      description: "Create a new chat session for a project",
      tags: ["chat"],
      body: CreateSessionBody,
      response: { 201: CreateSessionResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, createChatSession);

  app.get("/api/v1/chat/sessions", {
    schema: {
      description: "List chat sessions, optionally filtered by project",
      tags: ["chat"],
      querystring: ChatSessionsQuery,
      response: { 200: ChatSessionsListResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, listChatSessions);

  app.get("/api/v1/chat/sessions/:id/messages", {
    schema: {
      description: "List messages for a chat session",
      tags: ["chat"],
      params: ChatSessionIdParams,
      response: { 200: ChatMessagesResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, getChatMessages);

  app.delete("/api/v1/chat/sessions/:id", {
    schema: {
      description: "Delete a chat session",
      tags: ["chat"],
      params: ChatSessionIdParams,
      response: { 200: DeleteSessionResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
    },
  }, deleteChatSession);

  app.post("/api/v1/chat/sessions/:id/messages", {
    schema: {
      description: "Send a message and stream the assistant reply (SSE)",
      tags: ["chat"],
      params: ChatSessionIdParams,
      body: SendMessageBody,
      response: { 400: ErrorResponse, 404: ErrorResponse },
    },
    config: {
      rateLimit: {
        max: env.CHAT_RATE_LIMIT_MAX,
        timeWindow: "1 minute",
      },
    },
  }, streamChatMessage);

  return app;
}
