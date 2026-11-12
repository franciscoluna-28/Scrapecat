import { Type } from "@sinclair/typebox";
import { GitProviderSchema } from "@/shared/typebox";

export const CredentialIdParams = Type.Object({
  id: Type.String(),
});

export const AddCredentialBody = Type.Object({
  provider: Type.String({ minLength: 1 }),
  key: Type.String({ minLength: 1 }),
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
  provider: Type.String({ minLength: 1 }),
  key: Type.String({ minLength: 1 }),
});

export const VerifyCredentialResponse = Type.Object({
  valid: Type.Boolean(),
});

export const GitProviderParams = Type.Object({
  provider: GitProviderSchema,
});

export const ConnectGitProviderBody = Type.Object({
  token: Type.String({ minLength: 1 }),
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
