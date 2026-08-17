import { z } from "zod";
import { callAI } from "@/reports/ai";
import { resolveApiKey } from "@/credentials/services";
import { env } from "@/config/env";
import type { CommitDiff } from "@/repositories/git-reader";

export type SummarizableCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  diff: CommitDiff;
};

const DiffSummaryEntry = z.object({
  sha: z.string(),
  summary: z.string(),
  validated: z.boolean().default(false),
  notes: z.array(z.string()).default([]),
});

export type DiffSummary = z.infer<typeof DiffSummaryEntry>;

const DiffSummaryArray = z.array(DiffSummaryEntry);

export function fallbackSummary(commit: SummarizableCommit): DiffSummary {
  const files = commit.diff.filesChanged.join(", ") || "(no files)";
  return {
    sha: commit.sha,
    summary: `${commit.message}\n\nFiles changed: ${files} (+${commit.diff.additions}/-${commit.diff.deletions})`,
    validated: false,
    notes: ["LLM summary unavailable; used structural fallback."],
  };
}

function buildBatchPrompt(commits: SummarizableCommit[]): string {
  const blocks = commits.map((c, i) => {
    const header = `# Commit ${i + 1} — ${c.sha}\nMessage: ${c.message}\nAuthor: ${c.author}\nDate: ${c.date}\nFiles changed (${c.diff.additions}+ / ${c.diff.deletions}-): ${c.diff.filesChanged.join(", ") || "(none)"}`;
    const patch = c.diff.patch || "(no diff content)";
    return `${header}\n\`\`\`diff\n${patch}\n\`\`\``;
  });
  return [
    "Review the following commits. For EACH commit, verify the diff actually matches its commit message and summarize the real code changes.",
    "",
    "Rules:",
    "- Base the summary ONLY on the diff and code, never trust the commit message verbatim.",
    "- Return EXACTLY one JSON object per commit, in the same order.",
    '- Format: [{"sha":"<sha>","summary":"<2-4 sentence summary of the real code change>","validated":true|false,"notes":["<reason if not validated>"]}]',
    "- `validated` = true only if the diff is coherent and the change is real; false if the diff is empty, contradictory, or suspicious.",
    "- `summary` must describe what the code actually does, not restate the commit message.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

async function summarizeBatch(commits: SummarizableCommit[]): Promise<DiffSummary[]> {
  if (commits.length === 0) return [];

  const apiKey = (await resolveApiKey("openrouter")) || env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return commits.map(fallbackSummary);
  }

  try {
    const result = await callAI({
      provider: "openrouter",
      model: env.DIFF_SUMMARY_MODEL,
      apiKey,
      temperature: 0,
      maxTokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You are a meticulous code reviewer. You verify git diffs against their commit messages and write accurate, code-grounded summaries. You always respond with a single JSON array and nothing else.",
        },
        { role: "user", content: buildBatchPrompt(commits) },
      ],
    });

    const content = result.content.trim();
    const jsonStart = content.indexOf("[");
    const jsonEnd = content.lastIndexOf("]");
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new Error("No JSON array found in model response");
    }
    const parsed = DiffSummaryArray.safeParse(JSON.parse(content.slice(jsonStart, jsonEnd + 1)));
    if (!parsed.success) {
      throw new Error(`Invalid summary shape: ${parsed.error.message}`);
    }

    const bySha = new Map(parsed.data.map((d) => [d.sha, d]));
    return commits.map((c) => bySha.get(c.sha) ?? fallbackSummary(c));
  } catch (error) {
    console.error("Diff summarizer batch failed:", (error as Error)?.message ?? error);
    return commits.map(fallbackSummary);
  }
}

/**
 * Summarizes commits in batches of `env.DIFF_SUMMARY_BATCH_SIZE`, verifying
 * each diff and producing a code-grounded summary. Any per-batch failure falls
 * back to a structural summary — ingestion never hard-fails on the guardrail.
 */
export async function summarizeCommits(
  commits: SummarizableCommit[],
): Promise<DiffSummary[]> {
  if (!env.DIFF_SUMMARY_ENABLED || commits.length === 0) return commits.map(fallbackSummary);

  const batchSize = env.DIFF_SUMMARY_BATCH_SIZE;
  const results: DiffSummary[] = [];
  for (let i = 0; i < commits.length; i += batchSize) {
    const batch = commits.slice(i, i + batchSize);
    results.push(...(await summarizeBatch(batch)));
  }
  return results;
}
