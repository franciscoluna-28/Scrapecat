import type { AIMessage } from "@/chat/ai";
import {
  buildSystemPrompt,
  formatCitationForPrompt,
} from "@/chat/prompts";
import type { ChatCitation } from "@/db/schema";

export const REPORT_PROMPT_COMMIT_LIMIT = 200;

export function buildReportMessages(input: {
  repository: string;
  branch: string;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  citations: ChatCitation[];
}): AIMessage[] {
  const context = input.citations
    .slice(0, REPORT_PROMPT_COMMIT_LIMIT)
    .map(formatCitationForPrompt)
    .join("\n");

  return [
    {
      role: "system",
      content: buildSystemPrompt(input.repository, input.now, "founder"),
    },
    {
      role: "user",
      content: [
        "Write the scheduled engineering summary for this repository branch and period.",
        "Focus on what shipped and why it matters, grouped by outcome.",
        "Do not list commits individually.",
        "If nothing meaningful shipped, say so briefly.",
        "",
        `Repository: ${input.repository}`,
        `Branch: ${input.branch}`,
        `Period: ${input.periodStart.toISOString()} to ${input.periodEnd.toISOString()}`,
        "",
        "Commits in this period:",
        context || "(no commits)",
      ].join("\n"),
    },
  ];
}
