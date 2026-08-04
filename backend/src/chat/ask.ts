import { embedTexts } from "@/projects/embeddings";
import { searchChunks } from "@/projects/retrieval";
import * as projectsStore from "@/projects/stores/projects-store";
import { countChunksForProject } from "@/projects/stores/commit-chunks-store";
import { resolveApiKey } from "@/credentials/services";
import { callAI, cleanResponse } from "@/reports/ai";
import { CHAT_SYSTEM_PROMPT, buildAskPrompt } from "@/chat/prompts";
import { extractDateFilter, type DateFilter } from "@/chat/date-filter";

const MIN_SIMILARITY = 0.3;

const NO_CHUNKS_MESSAGE =
  "This project has no commits indexed yet. Generate a report for it first so its commits are chunked and embedded.";

const NOT_EMBEDDED_MESSAGE =
  "This project's commits are not embedded yet, so nothing can be searched. Check that an OpenRouter key is configured (EMBEDDING_ENABLED).";

function noMatchMessage(dateFilter: DateFilter): string {
  const window = dateFilter.label ? ` within ${dateFilter.label}` : "";
  return `No commits in the index match your question${window}. Try rephrasing it — note that only the last 100 commits per report window are indexed in this experimental version.`;
}

export class ChatError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function askAboutProject(input: {
  projectId: string;
  question: string;
  model?: string;
  provider?: string;
  limit?: number;
}) {
  const project = await projectsStore.getProjectById({ id: input.projectId });
  if (!project) {
    throw new ChatError("Project not found", 404);
  }

  const totalChunks = await countChunksForProject({ projectId: input.projectId });
  if (totalChunks === 0) {
    return { answer: NO_CHUNKS_MESSAGE, sources: [] };
  }

  const embeddedChunks = await countChunksForProject({
    projectId: input.projectId,
    embeddedOnly: true,
  });
  if (embeddedChunks === 0) {
    return { answer: NOT_EMBEDDED_MESSAGE, sources: [] };
  }

  const dateFilter = extractDateFilter(input.question);

  const [queryVector] = await embedTexts([input.question]);
  const sources = await searchChunks({
    projectId: input.projectId,
    queryVector,
    limit: input.limit ?? 5,
    startDate: dateFilter.startDate
      ? new Date(`${dateFilter.startDate}T00:00:00.000Z`)
      : undefined,
    endDate: dateFilter.endDate
      ? new Date(`${dateFilter.endDate}T23:59:59.999Z`)
      : undefined,
    minSimilarity: MIN_SIMILARITY,
  });

  if (sources.length === 0) {
    return { answer: noMatchMessage(dateFilter), sources: [] };
  }

  const apiKey = input.provider ? await resolveApiKey(input.provider) : undefined;

  const result = await callAI({
    model: input.model,
    provider: input.provider,
    apiKey: apiKey || undefined,
    maxTokens: 1024,
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildAskPrompt({
          question: input.question,
          sources,
          repository: project.repositoryName,
          dateFilter,
        }),
      },
    ],
  });

  return {
    answer: cleanResponse(result.content),
    sources: sources.map((s) => ({
      commitSha: s.commitSha,
      commitMessage: s.commitMessage,
      author: s.author,
      diffSummary: s.diffSummary,
      committedAt: s.committedAt,
      similarity: s.similarity,
    })),
  };
}
