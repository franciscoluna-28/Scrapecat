import { Type } from "@sinclair/typebox";

export const MetaResponse = Type.Object({
  datasetSource: Type.Union([Type.Literal("bundled"), Type.Literal("database")]),
  seedVersion: Type.Union([Type.String(), Type.Null()]),
  generatedAt: Type.Union([Type.String(), Type.Null()]),
  repos: Type.Array(
    Type.Object({
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      commitCount: Type.Integer(),
    }),
  ),
});