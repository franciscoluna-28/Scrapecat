import { Type } from "@sinclair/typebox";

export const GitHubConnectionResponse = Type.Object({
  connected: Type.Boolean(),
  source: Type.Union([
    Type.Literal("token"),
    Type.Literal("env"),
    Type.Literal("none"),
  ]),
  login: Type.Optional(Type.String()),
});

export const AddGitHubTokenBody = Type.Object({
  token: Type.String({ minLength: 1 }),
});
