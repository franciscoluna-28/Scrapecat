import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const ownerRepoParamsSchema = z.object({
  owner: z.string().min(1, "owner is required"),
  repo: z.string().min(1, "repo is required"),
});

export const listCommitsQuerySchema = z.object({
  limit: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branch: z.string().optional(),
});

export const countCommitsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const listReposQuerySchema = z.object({
  type: z.string().optional(),
  sort: z.string().optional(),
  direction: z.string().optional(),
  per_page: z.string().optional(),
});

export const RepoOwnerParams = Type.Object({
  owner: Type.String(),
  repo: Type.String(),
});

export const CommitsQuery = Type.Object({
  limit: Type.Optional(Type.String({ default: "100" })),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  branch: Type.Optional(Type.String()),
});

export const CommitsResponse = Type.Object({
  commits: Type.Array(
    Type.Object({
      sha: Type.String(),
      message: Type.String(),
      author: Type.String(),
      date: Type.String(),
      url: Type.Optional(Type.String()),
    }),
  ),
});

export const CommitsCountQuery = Type.Object({
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
});

export const CommitsCountResponse = Type.Object({
  count: Type.Integer(),
});

export const RepositoriesQuery = Type.Object({
  type: Type.Optional(Type.String({ default: "all" })),
  sort: Type.Optional(Type.String({ default: "updated" })),
  direction: Type.Optional(Type.String({ default: "desc" })),
  per_page: Type.Optional(Type.String({ default: "10" })),
});

export const RepositoriesResponse = Type.Array(
  Type.Record(Type.String(), Type.Any()),
);

export const BranchesResponse = Type.Object({
  branches: Type.Array(Type.String()),
});
