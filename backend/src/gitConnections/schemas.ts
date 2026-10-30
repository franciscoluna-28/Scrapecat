import { Type } from "@sinclair/typebox";
import { GitProviderSchema } from "@/shared/typebox";

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
