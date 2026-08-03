import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const projectIdParamsSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

export const projectCommitsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const ProjectIdParams = Type.Object({
  projectId: Type.String(),
});

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

export const ProjectCommitsQuery = Type.Object({
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
});

export const ProjectCommitsResponse = Type.Object({
  commits: Type.Array(
    Type.Object({
      id: Type.String(),
      commitSha: Type.String(),
      commitMessage: Type.String(),
      author: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      diffSummary: Type.String(),
      committedAt: Type.String({ format: "date-time" }),
      metadata: Type.Optional(Type.Any()),
    }),
  ),
});
