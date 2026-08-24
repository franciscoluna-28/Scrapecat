import { buildTemplateInstruction } from "@/reports/report-output";

const SYSTEM_PROMPT_BASE =
  "You are a Senior Product Manager working with non-technical stakeholders. Transform technical git commits into a high-level Product Update. Group related changes into functional categories. Use professional, outcome-oriented language. Focus on the 'System' or 'Platform' achievements, not individual people.";

export function buildSystemPrompt(customInstructions?: string | null): string {
  const parts = [SYSTEM_PROMPT_BASE, buildTemplateInstruction()];
  if (customInstructions?.trim()) {
    parts.push(
      "",
      "User Specifications:",
      customInstructions.trim(),
      "",
      "These specifications represent the user's priorities. Incorporate them into how you categorize and frame the updates.",
    );
  }
  return parts.join("\n");
}

export function getLanguageInstruction(customInstructions?: string | null): string {
  return customInstructions?.trim()
    ? `IMPORTANT: Detect the language of the user's instructions below and write the entire report in that same language.`
    : "Write the report in English.";
}

export type ReportCommit = {
  sha: string;
  message: string;
  summary: string;
  files: string[];
  filesChanged: number;
  commitUrl: string | null;
  flagged: boolean;
};

interface ReportPromptParams {
  repository: string;
  branch: string | null;
  startDate: string;
  endDate: string;
  commits: ReportCommit[];
  languageInstruction: string;
}

const MAX_FILES_IN_SCOPE = 10;

/**
 * Renders a single commit for the report prompt. The commit message is kept as
 * context, but the real grounding is the provable file scope and the commit
 * URL — the message can lie, the diff can't.
 */
function formatCommitForPrompt(commit: ReportCommit): string {
  const lines = [`- ${commit.message}`];
  const shown = commit.files.slice(0, MAX_FILES_IN_SCOPE);
  const fileDesc = shown.join(", ");
  const extra =
    commit.files.length > MAX_FILES_IN_SCOPE
      ? `, +${commit.files.length - MAX_FILES_IN_SCOPE} more`
      : "";
  lines.push(`  Files (${commit.filesChanged} changed): ${fileDesc}${extra}`);
  if (commit.commitUrl) {
    lines.push(`  Commit: ${commit.commitUrl}`);
  }
  if (commit.flagged) {
    lines.push(
      "  Note: the commit message looks uninformative — base this item on the actual file changes above.",
    );
  }
  return lines.join("\n");
}

export function buildReportPrompt(params: ReportPromptParams): string {
  const commitLines = params.commits.map(formatCommitForPrompt).join("\n");
  return [
    `Generate a Product Update for ${params.repository} (${params.branch}) from ${params.startDate} to ${params.endDate}.`,
    "",
    "Raw Activity Data:",
    commitLines,
    "",
    "For each commit, the commit message is only a hint. Trust the file changes and commit links as the ground truth for what was actually done and why.",
    "",
    params.languageInstruction,
    "",
    "Fill in the markdown template provided in the system instructions.",
    "Match the structure exactly — title, H2 sections with bullets, and a Strategic Direction conclusion.",
    "Do not add any text outside the template.",
  ].join("\n");
}

