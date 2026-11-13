import { readFile } from "node:fs/promises";
import { z } from "zod";

export const GOLDEN_CATEGORIES = [
  "semantic",
  "keyword",
  "temporal",
  "negative",
] as const;

export type GoldenCategory = (typeof GOLDEN_CATEGORIES)[number];

const goldenCaseSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  category: z.enum(GOLDEN_CATEGORIES).default("semantic"),
  relevantShas: z.array(z.string().min(1)).default([]),
  window: z
    .object({
      startDate: z.string().min(1).optional(),
      endDate: z.string().min(1).optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

const goldenDatasetSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    project: z.object({
      gitProvider: z.enum(["github", "gitlab"]).default("github"),
      providerOwner: z.string().min(1),
      repositoryName: z.string().min(1),
      branch: z.string().min(1),
    }),
    embeddingSpace: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
      })
      .optional(),
    cases: z.array(goldenCaseSchema).min(1),
  })
  .superRefine((dataset, ctx) => {
    const seen = new Set<string>();
    dataset.cases.forEach((goldenCase, index) => {
      if (seen.has(goldenCase.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "id"],
          message: `duplicate case id "${goldenCase.id}"`,
        });
      }
      seen.add(goldenCase.id);

      if (goldenCase.category === "negative" && goldenCase.relevantShas.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "relevantShas"],
          message: "negative cases must not list relevantShas",
        });
      }
      if (goldenCase.category !== "negative" && goldenCase.relevantShas.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "relevantShas"],
          message: "non-negative cases must list at least one relevant SHA",
        });
      }
    });
  });

export type GoldenCase = z.infer<typeof goldenCaseSchema>;
export type GoldenDataset = z.infer<typeof goldenDatasetSchema>;

export function parseGoldenDataset(value: unknown): GoldenDataset {
  return goldenDatasetSchema.parse(value);
}

export async function loadGoldenDataset(filePath: string): Promise<GoldenDataset> {
  const raw = await readFile(filePath, "utf8");
  return parseGoldenDataset(JSON.parse(raw));
}
