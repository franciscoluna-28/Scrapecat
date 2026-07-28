import { z } from "zod";

export const commitsInputSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
  url: z.string().optional(),
});

export const reportInputSchema = z.object({
  repository: z.string(),
  githubOwner: z.string(),
  githubProjectId: z.number(),
  branch: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  commits: z.array(commitsInputSchema),
  customInstructions: z.string().optional(),
  quickMode: z.boolean().optional(),
  model: z.string().optional(),
  provider: z.enum(["openrouter", "deepseek"]).optional(),
});

export const addCredentialSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1).default("Default"),
  key: z.string().min(1, "API key is required"),
});

export const credentialIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const verifyCredentialSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "API key is required"),
});
