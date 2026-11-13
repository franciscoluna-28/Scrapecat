import { Type } from "@sinclair/typebox";

export const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
});

export const HealthReadyResponse = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
});

export const MetaResponse = Type.Object({
  datasetSource: Type.Literal("database"),
  seedVersion: Type.Null(),
  generatedAt: Type.Null(),
  repos: Type.Array(
    Type.Object({
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      commitCount: Type.Integer(),
    }),
  ),
});
