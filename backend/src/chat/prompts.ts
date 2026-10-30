import type { ChatCitation } from "@/db/schema";

/** Who the answer is written for. */
export const PERSONAS = ["founder", "cto", "engineer"] as const;
export type Persona = (typeof PERSONAS)[number];
export const DEFAULT_PERSONA: Persona = "founder";

export function resolvePersona(value?: string | null): Persona {
  return (PERSONAS as readonly string[]).includes(value ?? "")
    ? (value as Persona)
    : DEFAULT_PERSONA;
}

const SYSTEM_PROMPT = `You are Scrapecat, an engineering intelligence assistant. You answer questions about a repository's engineering history — what changed, who changed it, and when.

Rules:
- Answer ONLY from the retrieved commits provided in the context. Never invent facts, dates, or commits.
- Treat the present moment as the date given in the context. Interpret relative time ("now", "currently", "this week", "this month", "lately") against that date and against the commit dates provided.
- For present-tense questions ("What feature is being built?", "What are we working on?", "What's the current state?"), answer from the MOST RECENT commits in the context — the ones closest to the last commit date. Never present old commits as current work.
- Group related commits into feature-level summaries under the descriptive headings specified by the tone section below.
- Focus on the major changes: features, breaking changes, PR merges, and large refactors. Minor fixes and chores can be grouped under a single line or omitted.
- Do NOT list commits individually. Only reference specific SHAs if the user explicitly asks for details.
- If the retrieved commits do not contain the answer, say so directly instead of guessing.
- If the question is out of context, fallback to "I'm sorry, I cannot help with this question as it is out of my scope."
- Be concise and factual. Use markdown headings and bullets when a list helps.`;

/**
 * Audience-specific tone. The default (`founder`) keeps answers useful to
 * non-engineers — which is the product's whole point — while `cto` and
 * `engineer` add progressively more technical substance.
 */
const PERSONA_TONE: Record<Persona, string> = {
  founder: `Audience & tone:
- You are briefing a founder or executive who is not an engineer. Use plain, jargon-free language.
- Lead with what changed and why it matters — outcomes and user/business impact, not implementation.
- Avoid file paths, SHAs, framework and library names, and commit-speak unless the user explicitly asks.
- Group changes under outcome-oriented headings such as "New capabilities", "Fixes", "Reliability", "Cleanup".`,
  cto: `Audience & tone:
- You are briefing a CTO. Balance business impact with technical substance.
- Name the major systems, components, and architectural changes, but stay concise.
- Skip low-level file-by-file detail and SHAs unless the user explicitly asks.
- Group changes under headings such as "New capabilities", "Architecture", "Fixes", "Reliability".`,
  engineer: `Audience & tone:
- You are briefing an engineer. Be precise and technical.
- Include the components, files, and implementation details that matter.
- Group changes under headings such as "Features", "Refactors", "Fixes", "Infrastructure".`,
};

export const MAX_FILES_SHOWN = 6;

export function buildSystemPrompt(
  repository?: string | null,
  now: Date = new Date(),
  persona: Persona = DEFAULT_PERSONA,
): string {
  const today = now.toISOString().slice(0, 10);
  const temporal = `The current date is ${today} (UTC).`;
  const tone = PERSONA_TONE[persona] ?? PERSONA_TONE[DEFAULT_PERSONA];
  const parts = [SYSTEM_PROMPT, tone, temporal];
  if (repository) parts.push(`You are answering about the repository: ${repository}.`);
  return parts.join("\n\n");
}

export function formatCitationForPrompt(c: ChatCitation): string {
  const files = c.filesChanged.slice(0, MAX_FILES_SHOWN);
  const lines = [
    `- SHA: ${c.commitSha}`,
    `  Message: ${c.commitMessage}`,
    `  Author: ${c.author ?? "unknown"}`,
    `  Date: ${c.committedAt}`,
  ];
  if (files.length > 0) {
    const extra = c.filesChanged.length > MAX_FILES_SHOWN
      ? `, +${c.filesChanged.length - MAX_FILES_SHOWN} more`
      : "";
    lines.push(`  Files: ${files.join(", ")}${extra}`);
  }
  if (c.commitUrl) lines.push(`  URL: ${c.commitUrl}`);
  return lines.join("\n");
}

export function buildUserMessage(
  query: string,
  citations: ChatCitation[],
  scope?: { branch?: string | null; startDate?: Date; endDate?: Date; now?: Date },
): string {
  const context = citations.map(formatCitationForPrompt).join("\n");
  const filters = [
    scope?.branch ? `Branch: ${scope.branch}` : "Branch: all branches",
    scope?.now ? `Present moment: ${scope.now.toISOString()}` : null,
    scope?.startDate ? `From: ${scope.startDate.toISOString()}` : null,
    scope?.endDate ? `To: ${scope.endDate.toISOString()}` : null,
  ].filter(Boolean).join("\n");
  return [
    "Summarize the retrieved commits below at a feature level. Group related changes under descriptive headings that fit the audience described in your instructions, and focus on the most impactful changes. Do not list commits individually.",
    "If the question is phrased in the present tense or refers to the current moment, answer from the commits closest to the \"To\" date in the scope below — those are the most recent work.",
    "If no commits were retrieved, explicitly say that no indexed commits matched the requested branch/date scope. Do not infer that nothing changed outside that scope.",
    "",
    "Retrieval scope:",
    filters,
    "",
    "Retrieved commits:",
    context || "(no relevant commits retrieved)",
    "",
    `Question: ${query}`,
  ].join("\n");
}
