const SYSTEM_PROMPT_BASE =
  "You are a Senior Product Manager working with non-technical stakeholders. Your task is to transform technical git commits into a high-level Product Update. Group related technical tasks into functional categories (e.g., Infrastructure, User Experience, Data Reliability). Use professional, outcome-oriented language. Remove individual names and focus on the 'System' or 'Platform' achievements.";

export function buildSystemPrompt(customInstructions?: string | null): string {
  if (!customInstructions?.trim()) return SYSTEM_PROMPT_BASE;
  return `${SYSTEM_PROMPT_BASE}\n\nUser Specifications:\n${customInstructions.trim()}\n\nDuring your analysis, carefully consider these specifications. They represent the user's priorities and should guide how you categorize and frame the updates.`;
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
    `Context: Technical activity log for ${params.repository} (${params.branch}) from ${params.startDate} to ${params.endDate}.`,
    "",
    "Raw Activity Data:",
    commitLines,
    "",
    'Task: Synthesize this data into a "Product Update" style report.',
    "",
    params.languageInstruction,
    "",
    "Before writing the final report, reason step-by-step inside <thinking> tags:",
    "<thinking>",
    "1. Analyze each commit message and identify the core technical change.",
    "2. Group related changes into functional categories, considering any user specifications provided.",
    "3. For each category, determine the product-level impact of the changes.",
    "4. Verify the report structure matches the required format.",
    "5. Ensure all user specifications have been addressed.",
    "</thinking>",
    "",
    "After closing the thinking tag, output ONLY the final markdown report with no additional commentary.",
    "",
    "Guidelines:",
    "1. DO NOT mention developer names or commit counts.",
    '2. GROUP small technical changes into 3-4 high-level functional categories (e.g., "Feature Development", "Infrastructure & Performance", "UI Refinement", "Data Layer").',
    '3. TRANSLATE technical actions into product value (e.g., instead of "added SWR", use "Implemented reactive data fetching for improved UI snappiness").',
    "4. BE CONCISE. Use bullet points that start with a strong verb.",
    "5. Prioritize features and fix commits.",
    "6. ABSOLUTELY NO SEPARATORS: Do not use horizontal rules (---, ***), dividers, or any visual separator elements.",
    "",
    "Formatting:",
    "- Use markdown format.",
    "- Each bullet point is a separate line starting with '- '.",
    "- Bullet points must NOT be inlined on the same line. Each bullet is its own line.",
    "- Put an empty line between each bullet point.",
    "- NEVER use '\u2022', '*', '+', or any other bullet symbol. ONLY '- ' at the start of the line.",
    "",
    "Constraints:",
    "- Constraint: Avoid mentioning technical details like libraries or frameworks, focus on the business logic and user impact.",
    "- Constraint: Use 'Engineering Updates' style. Avoid flowery adjectives like 'groundbreaking' or 'revolutionary'. Stick to neutral, high-leverage verbs (Optimized, Scaled, Standardized, Integrated).",
    "- Constraint: Maximum 300 words if there are more than 5 commits.",
    "- Constraint: Maximum 4 categories.",
    "- Constraint: If the commits are less than 5, maximum 200 words and 2 categories.",
    "",
    "Structure:",
    "- Title: Product Update - [Project Name]",
    "- 3-4 Categorized H2 sections (## Category Name). Within each section, 2-4 bullet points using markdown list syntax, one per line.",
    "- Summary of Strategic Direction as a H3 tag (### Strategic Direction, 1-3 sentences).",
    "- Match the changes according to the commits and their dates. For example, if we did not have changes in a category, do not include it.",
  ].join("\n");
}

export function buildRefinePrompt(reply: string): string {
  return `Refine the report based on this feedback:\n${reply}\n\nFirst reason inside <thinking> tags, then output ONLY the updated markdown report.`;
}

export const FALLBACK_REPORT = `# Executive Summary

## Business Impact
Unable to generate summary due to API rate limits. Please try again later.

## Key Achievements
Report generation temporarily unavailable.

## Productivity Overview
Rate limit reached. Consider upgrading API plan for higher limits.

## Strategic Insights
- Wait a few minutes before retrying
- Consider reducing data size for faster processing`;
