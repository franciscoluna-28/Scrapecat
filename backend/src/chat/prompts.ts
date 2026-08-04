import type { RetrievedChunk } from "@/projects/retrieval";
import type { DateFilter } from "@/chat/date-filter";

export const CHAT_SYSTEM_PROMPT = [
  "You are a code-intelligence assistant that answers questions about commits and changes made in a software project.",
  "Use ONLY the relevant commits provided in the user's message as evidence.",
  "Pay close attention to each commit's date when answering questions about WHEN things happened.",
  "When you reference a commit, cite it by its short SHA (first 7 characters) and its date.",
  "If the provided commits do not answer the question (including within the asked time window), say so instead of inventing commits or changes.",
].join(" ");

export function buildAskPrompt({
  question,
  sources,
  repository,
  dateFilter,
}: {
  question: string;
  sources: RetrievedChunk[];
  repository: string;
  dateFilter?: DateFilter | null;
}): string {
  const lines = sources.map((s, i) => {
    const sha = s.commitSha.slice(0, 7);
    const author = s.author ?? "unknown";
    const date = s.committedAt
      ? new Date(s.committedAt).toISOString().slice(0, 10)
      : "unknown date";
    return `[${i + 1}] (${sha}, ${author}, committed ${date}) ${s.commitMessage}\n${s.diffSummary}`;
  });

  const parts = [
    `Project: ${repository}`,
    "",
    `Question: ${question}`,
  ];

  if (dateFilter?.label) {
    parts.push("", `Time window in question: ${dateFilter.label}`);
  }

  parts.push(
    "",
    "Relevant commits:",
    lines.length > 0 ? lines.join("\n\n") : "(none retrieved)",
    "",
    "Answer the question using only the relevant commits above. Cite commit SHAs and dates when you reference them.",
  );

  return parts.join("\n");
}
