import { z } from "zod";

/** Parses the commit data from the GitHub API
 * Used to validate commits before generating the report
 */
export const commitsInputSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
  url: z.string().optional(),
});

/** Parses the report data from the frontend
 * Used to generate the report using the Groq API
 */
export const reportInputSchema = z.object({
  repository: z.string(),
  branch: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  commits: z.array(commitsInputSchema),
});
