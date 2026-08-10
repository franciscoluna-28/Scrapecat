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

interface ReportPromptParams {
  repository: string;
  branch: string | null;
  startDate: string;
  endDate: string;
  commits: { message: string }[];
  languageInstruction: string;
}

export function buildReportPrompt(params: ReportPromptParams): string {
  const commitLines = params.commits.map((c) => `- ${c.message}`).join("\n");
  return [
    `Generate a Product Update for ${params.repository} (${params.branch}) from ${params.startDate} to ${params.endDate}.`,
    "",
    "Raw Activity Data:",
    commitLines,
    "",
    params.languageInstruction,
    "",
    "Fill in the markdown template provided in the system instructions.",
    "Match the structure exactly — title, H2 sections with bullets, and a Strategic Direction conclusion.",
    "Do not add any text outside the template.",
  ].join("\n");
}

