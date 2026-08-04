import { embedTexts } from "@/projects/embeddings";
import { searchChunks } from "@/projects/retrieval";
import * as projectsStore from "@/projects/stores/projects-store";
import { resolveApiKey } from "@/credentials/services";
import { callAI, cleanResponse } from "@/reports/ai";
import { CHAT_SYSTEM_PROMPT, buildAskPrompt } from "@/chat/prompts";

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

  const [queryVector] = await embedTexts([input.question]);
  const sources = await searchChunks({
    projectId: input.projectId,
    queryVector,
    limit: input.limit ?? 5,
  });

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
