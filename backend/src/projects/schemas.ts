import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const projectIdParamsSchema = z.object({
  id: z.string().min(1, "project id is required"),
});

export const syncStatusQuerySchema = z.object({
  branch: z.string().optional(),
});

export const ProjectsResponse = Type.Object({
  projects: Type.Array(
    Type.Object({
      id: Type.String(),
      gitProvider: Type.String(),
      providerProjectId: Type.String(),
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      createdAt: Type.String({ format: "date-time" }),
      updatedAt: Type.String({ format: "date-time" }),
    }),
  ),
});

export const ProjectIdParams = Type.Object({
  id: Type.String(),
});

export const SyncStatusQuery = Type.Object({
  branch: Type.Optional(Type.String({ default: "main" })),
});

export const ProjectSyncStatusResponse = Type.Object({
  projectId: Type.String(),
  branch: Type.String(),
  watermark: Type.Union([
    Type.Null(),
    Type.Object({
      sha: Type.String(),
      at: Type.String({ format: "date-time" }),
    }),
  ]),
  latestJob: Type.Union([
    Type.Null(),
    Type.Object({
      id: Type.String(),
      status: Type.String(),
      attempts: Type.Integer(),
      error: Type.Union([Type.Null(), Type.String()]),
      scheduledAt: Type.String({ format: "date-time" }),
      startedAt: Type.Union([Type.Null(), Type.String({ format: "date-time" })]),
      finishedAt: Type.Union([Type.Null(), Type.String({ format: "date-time" })]),
    }),
  ]),
  totals: Type.Object({
    chunks: Type.Integer(),
    embedded: Type.Integer(),
  }),
});
