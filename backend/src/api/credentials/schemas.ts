import { Type } from "@sinclair/typebox";
import type { FastifySchema } from "fastify";
import { ErrorResponse, GitProviderSchema } from "@/shared/typebox";
import { PROVIDER_REGISTRY } from "@/shared/integrations/providers/registry";
import { GIT_PROVIDERS } from "@/shared/integrations/git-provider/registry";

export const CredentialIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const CredentialProviderSchema = Type.Union(
  (Object.keys(PROVIDER_REGISTRY) as Array<keyof typeof PROVIDER_REGISTRY>).map(
    (provider) => Type.Literal(provider),
  ),
);

/**
 * Read filter accepts every credential kind (AI keys and git tokens); writes
 * stay AI-only because git tokens go through the connection routes.
 */
export const CredentialFilterProviderSchema = Type.Union([
  ...(
    Object.keys(PROVIDER_REGISTRY) as Array<keyof typeof PROVIDER_REGISTRY>
  ).map((provider) => Type.Literal(provider)),
  ...GIT_PROVIDERS.map((provider) => Type.Literal(provider)),
]);

export const CredentialsQuery = Type.Object({
  provider: Type.Optional(CredentialFilterProviderSchema),
});

export const AddCredentialBody = Type.Object({
  provider: CredentialProviderSchema,
  key: Type.String({ minLength: 1, maxLength: 4096 }),
});

const CredentialResponse = Type.Object({
  id: Type.String(),
  provider: Type.String(),
  keyHint: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export const CredentialListResponse = Type.Object({
  keys: Type.Array(CredentialResponse),
});

export const CredentialCreatedResponse = Type.Object({
  id: Type.String(),
});

export const VerifyCredentialBody = Type.Object({
  provider: CredentialProviderSchema,
  key: Type.String({ minLength: 1, maxLength: 4096 }),
});

export const VerifyCredentialResponse = Type.Object({
  valid: Type.Boolean(),
});

export const GitProviderParams = Type.Object({
  provider: GitProviderSchema,
});

export const ConnectGitProviderBody = Type.Object({
  token: Type.String({ minLength: 1, maxLength: 4096 }),
});

export const GitConnectionResponse = Type.Object({
  connected: Type.Boolean(),
  source: Type.Union([
    Type.Literal("token"),
    Type.Literal("env"),
    Type.Literal("none"),
  ]),
  login: Type.Optional(Type.String()),
});

export const ListCredentialsRoute = {
  description: "List stored credentials (key hints only, no full keys returned)",
  tags: ["credentials"],
  querystring: CredentialsQuery,
  response: { 200: CredentialListResponse, 400: ErrorResponse },
} satisfies FastifySchema;

export const AddCredentialRoute = {
  description: "Store a new credential (API key encrypted at rest)",
  tags: ["credentials"],
  body: AddCredentialBody,
  response: {
    201: CredentialCreatedResponse,
    400: ErrorResponse,
    403: ErrorResponse,
  },
} satisfies FastifySchema;

export const DeleteCredentialRoute = {
  description: "Delete a stored credential",
  tags: ["credentials"],
  params: CredentialIdParams,
  response: {
    204: {},
    400: ErrorResponse,
    403: ErrorResponse,
    404: ErrorResponse,
  },
} satisfies FastifySchema;

export const VerifyCredentialRoute = {
  description: "Verify an API key against its provider",
  tags: ["credentials"],
  body: VerifyCredentialBody,
  response: { 200: VerifyCredentialResponse, 400: ErrorResponse },
} satisfies FastifySchema;

export const ConnectGitProviderRoute = {
  description: "Store a git provider token (connect an account)",
  tags: ["git-providers"],
  params: GitProviderParams,
  body: ConnectGitProviderBody,
  response: { 201: GitConnectionResponse, 400: ErrorResponse, 403: ErrorResponse },
} satisfies FastifySchema;

export const GetGitProviderConnectionRoute = {
  description:
    "Git provider connection status (stored token / env token / none)",
  tags: ["git-providers"],
  params: GitProviderParams,
  response: {
    200: GitConnectionResponse,
    400: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;

export const DisconnectGitProviderRoute = {
  description: "Disconnect a git provider (removes the stored token)",
  tags: ["git-providers"],
  params: GitProviderParams,
  response: {
    204: {},
    400: ErrorResponse,
    403: ErrorResponse,
    404: ErrorResponse,
  },
} satisfies FastifySchema;
