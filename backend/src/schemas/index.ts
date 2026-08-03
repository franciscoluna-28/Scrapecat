import { z } from "zod";

export const reportInputSchema = z.object({
  repository: z.string(),
  githubOwner: z.string(),
  githubProjectId: z.number(),
  branch: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  customInstructions: z.string().optional(),
  quickMode: z.boolean().optional(),
  model: z.string().optional(),
  provider: z
    .enum(["openrouter", "deepseek", "openai"])
    .optional(),
});

export const addCredentialSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "API key is required"),
});

export const credentialIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const verifyCredentialSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "API key is required"),
});

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

export const listKeysQuerySchema = z.object({
  provider: z.string().optional(),
});

export const listReportsQuerySchema = z.object({
  projectId: z.string().optional(),
});

export const projectIdParamsSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

export const projectCommitsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const reportIdParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

export const updateReportBodySchema = z.object({
  editableMarkdown: z.string().min(1, "editableMarkdown is required"),
});

export const listReposQuerySchema = z.object({
  type: z.string().optional(),
  sort: z.string().optional(),
  direction: z.string().optional(),
  per_page: z.string().optional(),
});

export const replyBodySchema = z.object({
  reply: z.string().min(1, "reply is required"),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export const reportInputBodySchema = z.object({
  data: reportInputSchema,
});
