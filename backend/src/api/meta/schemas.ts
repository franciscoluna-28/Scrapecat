import { Type } from "@sinclair/typebox";

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
