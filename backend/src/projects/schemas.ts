import { Type } from "@sinclair/typebox";

export const ProjectsResponse = Type.Object({
  projects: Type.Array(
    Type.Object({
      id: Type.String(),
      githubProjectId: Type.Integer(),
      githubOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      createdAt: Type.String({ format: "date-time" }),
      updatedAt: Type.String({ format: "date-time" }),
    }),
  ),
});
