
import { z } from "zod";

export const RepositoryInputDto = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  updated_at: z.string(),
});

export const ProjectIdSchema = z.object({
  projectId: z.number().positive(),
});

export type RepositoryInput = z.infer<typeof RepositoryInputDto>;
export type ProjectIdInput = z.infer<typeof ProjectIdSchema>;
