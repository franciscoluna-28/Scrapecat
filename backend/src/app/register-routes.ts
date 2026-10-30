import type { FastifyInstance } from "fastify";
import { env } from "@/config/env";
import { health, ready } from "@/health/routes";
import { getMeta } from "@/meta/routes";
import { listModels } from "@/models/routes";
import {
  listRepositories,
  listBranches,
  listCommits,
  countCommits,
} from "@/gitRepositories/routes";
import {
  listProjects,
  prepareBranch,
  createProject as createProjectRoute,
} from "@/projects/routes";
import {
  listKeys as listCredentials,
  addKey as addCredential,
  deleteKey as deleteCredential,
  verifyKey as verifyCredential,
} from "@/credentials/routes";
import { getSettingsRoute, updateSettingsRoute } from "@/settings/routes";
import {
  connectProvider,
  getProviderConnection,
  disconnectProvider,
} from "@/gitConnections/routes";
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
import { HealthReadyResponse, HealthResponse } from "@/health/schemas";
import { MetaResponse } from "@/meta/schemas";
import { ModelsQuery, ModelsResponse } from "@/models/schemas";
import {
  RepoOwnerParams,
  BranchesQuery,
  CommitsQuery,
  CommitsResponse,
  CommitsCountQuery,
  CommitsCountResponse,
  RepositoriesQuery,
  RepositoriesResponse,
  BranchesResponse,
} from "@/gitRepositories/schemas";
import {
  PrepareBranchBody,
  PrepareBranchResponse,
  ProjectIdParams,
  CreateProjectBody,
  CreateProjectResponse,
  ProjectsResponse,
} from "@/projects/schemas";
import {
  AddCredentialBody,
  CredentialListResponse,
  CredentialCreatedResponse,
  CredentialIdParams,
  VerifyCredentialBody,
  VerifyCredentialResponse,
} from "@/credentials/schemas";
import { AISettingsBody, AISettingsGetResponse } from "@/settings/schemas";
import {
  GitProviderParams,
  ConnectGitProviderBody,
  GitConnectionResponse,
} from "@/gitConnections/schemas";

export function registerRoutes(app: FastifyInstance) {
  registerSystemRoutes(app);
  registerGitProviderRoutes(app);
  registerModelRoutes(app);
  registerRepositoryRoutes(app);
  registerProjectRoutes(app);
  registerCredentialRoutes(app);
  registerSettingsRoutes(app);
  registerChatRoutes(app);
}

function registerSystemRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", {
    schema: {
      description: "Health check endpoint",
      tags: ["health"],
      response: { 200: HealthResponse },
    },
  }, health);

  app.get("/api/v1/health/ready", {
    schema: {
      description: "Readiness check (verifies the database connection)",
      tags: ["health"],
      response: { 200: HealthReadyResponse, 503: HealthReadyResponse },
    },
  }, ready);

  app.get("/api/v1/meta", {
    schema: {
      description: "Describe the data backing the API (bundled demo dataset vs database)",
      tags: ["meta"],
      response: { 200: MetaResponse, 500: ErrorResponse },
    },
  }, getMeta);
}

function registerGitProviderRoutes(app: FastifyInstance) {
  app.post("/api/v1/git-providers/:provider/connection", {
    schema: {
      description: "Store a git provider token (connect an account)",
      tags: ["git-providers"],
      params: GitProviderParams,
      body: ConnectGitProviderBody,
      response: { 201: GitConnectionResponse, 400: ErrorResponse },
    },
  }, connectProvider);

  app.get("/api/v1/git-providers/:provider/connection", {
    schema: {
      description: "Git provider connection status (stored token / env token / none)",
      tags: ["git-providers"],
      params: GitProviderParams,
      response: { 200: GitConnectionResponse, 400: ErrorResponse, 500: ErrorResponse },
    },
  }, getProviderConnection);

  app.delete("/api/v1/git-providers/:provider/connection", {
    schema: {
      description: "Disconnect a git provider (removes the stored token)",
      tags: ["git-providers"],
      params: GitProviderParams,
      response: { 204: {}, 400: ErrorResponse, 404: ErrorResponse },
    },
  }, disconnectProvider);
}

function registerModelRoutes(app: FastifyInstance) {
  app.get("/api/v1/models", {
    schema: {
      description: "List available AI models",
      tags: ["models"],
      querystring: ModelsQuery,
      response: { 200: ModelsResponse, 400: ErrorResponse },
    },
  }, listModels);
}

function registerRepositoryRoutes(app: FastifyInstance) {
  app.get("/api/v1/repositories", {
    schema: {
      description: "List repositories from every connected git provider",
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
      querystring: BranchesQuery,
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
}

function registerProjectRoutes(app: FastifyInstance) {
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
}

function registerCredentialRoutes(app: FastifyInstance) {
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
}

function registerSettingsRoutes(app: FastifyInstance) {
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
}

function registerChatRoutes(app: FastifyInstance) {
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
}
