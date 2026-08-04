import type { RetrievedChunk } from "@/projects/retrieval";

export const CHAT_SYSTEM_PROMPT = [
  "You are a code-intelligence assistant that answers questions about commits and changes made in a software project.",
  "Use ONLY the relevant commits provided in the user's message as evidence.",
  "When you reference a commit, cite it by its short SHA (first 7 characters).",
  "If the provided commits do not answer the question, say so instead of inventing commits or changes.",
].join(" ");

export function buildAskPrompt({
  question,
  sources,
  repository,
}: {
  question: string;
  sources: RetrievedChunk[];
  repository: string;
}): string {
  const lines = sources.map((s, i) => {
    const sha = s.commitSha.slice(0, 7);
    const author = s.author ?? "unknown";
    return `[${i + 1}] (${sha}, ${author}) ${s.commitMessage}\n${s.diffSummary}`;
  });

  return [
    `Project: ${repository}`,
    "",
    `Question: ${question}`,
    "",
    "Relevant commits:",
    lines.length > 0 ? lines.join("\n\n") : "(none retrieved)",
    "",
    "Answer the question using only the relevant commits above. Cite commit SHAs when you reference them.",
  ].join("\n");
}
