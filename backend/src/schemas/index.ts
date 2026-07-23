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
});
