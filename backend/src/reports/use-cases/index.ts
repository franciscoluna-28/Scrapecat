import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { resolveApiKey } from "@/credentials/services";
import { embedNewChunks } from "@/projects/embed-chunks";
import {
  MAX_LIMIT,
  fetchProjectCommits,
  buildMissingChunks,
  writeChunks,
} from "@/projects/sync";
import * as projectsStore from "@/projects/stores/projects-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import { reportInputSchema } from "@/reports/schemas";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
  buildRefinePrompt,
} from "@/reports/prompts";
import { validateReportStructure, buildTemplateInstruction } from "@/reports/report-output";
import { callAI, cleanResponse } from "@/reports/ai";
import { extractReportTitle } from "@/shared/utils";

export type CreateReportInput = z.infer<typeof reportInputSchema>;

export class NoCommitsError extends Error {
  readonly status = 400;
  constructor() {
    super("Cannot generate report: no commits found in the selected date range");
  }
}

export class AIGenerationError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }

  static from(error: unknown): AIGenerationError {
    const status = (error as any)?.status;
    if (status === 429) {
      return new AIGenerationError(
        "AI rate limit reached. Please wait a moment and try again.",
        429,
      );
    }
    return new AIGenerationError(
      "AI report generation failed. Please try again.",
      500,
    );
  }
}

export class ReportNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Report not found");
  }
}

async function generateReport(opts: {
  input: CreateReportInput;
  commits: { message: string }[];
  apiKey?: string | null;
  provider?: string;
}): Promise<string> {
  const customInstructions = opts.input.customInstructions?.trim();
  const languageInstruction = getLanguageInstruction(customInstructions);
  const systemPrompt = buildSystemPrompt(customInstructions);

  const prompt = buildReportPrompt({
    repository: opts.input.repository,
    branch: opts.input.branch,
    startDate: opts.input.startDate,
    endDate: opts.input.endDate,
    commits: opts.commits,
    languageInstruction,
  });

  const maxAttempts = 2;
  let lastError: unknown = null;
  let lastReport = "";

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    let content: string;
    let finishReason: string | null | undefined;
    try {
      const result = await callAI({
        model: opts.input.model,
        provider: opts.provider,
        apiKey: opts.apiKey || undefined,
        maxTokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              attempts > 1
                ? `${prompt}\n\nYour previous response did not follow the required structure. Follow the template exactly:\n\n${buildTemplateInstruction()}`
                : prompt,
          },
        ],
      });
      content = result.content;
      finishReason = result.finishReason;
    } catch (error) {
      lastError = error;
      console.error(`AI report call failed (attempt ${attempts}/${maxAttempts}):`, error);
      continue;
    }

    if (finishReason === "length") {
      console.warn(`Report truncated by token limit (attempt ${attempts}/${maxAttempts})`);
      continue;
    }

    const cleaned = cleanResponse(content);
    if (cleaned.length > 50) {
      const validation = validateReportStructure(cleaned);
      if (validation.valid) {
        return cleaned;
      }
      console.warn(`Report structure invalid (attempt ${attempts}/${maxAttempts}):`, validation.errors);
    }
    lastReport = cleaned;
  }

  if (lastError) {
    throw AIGenerationError.from(lastError);
  }
  console.error("AI never produced a valid report after retries:", lastReport);
  throw new AIGenerationError(
    "AI failed to produce a valid report after retries. Please try again.",
    500,
  );
}

export async function createReportUseCase(input: CreateReportInput) {
  const provider = input.provider;
  const apiKey = provider ? await resolveApiKey(provider) : undefined;

  const commits = await fetchProjectCommits({
    owner: input.githubOwner,
    repo: input.repository,
    branch: input.branch,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (commits.length === 0) {
    throw new NoCommitsError();
  }

  // Upsert outside the tx to learn project.id — buildMissingChunks needs it to
  // dedupe chunks, and we can't know the uuid without persisting the row first.
  const project = await projectsStore.upsertProject({
    input: {
      githubProjectId: input.githubProjectId,
      githubOwner: input.githubOwner,
      repositoryName: input.repository,
      defaultBranch: input.branch,
    },
  });

  const chunks = await buildMissingChunks({
    projectId: project.id,
    commits,
    branch: input.branch,
  });

  const generatedReport = await generateReport({
    input,
    commits,
    apiKey,
    provider,
  });

  const reportId = randomUUID();

  await db.transaction(async (tx) => {
    // Re-upsert inside the tx (idempotent via onConflictDoUpdate) so the project
    // write is part of the atomic commit alongside chunks + report.
    await projectsStore.upsertProject({
      input: {
        githubProjectId: input.githubProjectId,
        githubOwner: input.githubOwner,
        repositoryName: input.repository,
        defaultBranch: input.branch,
      },
      tx,
    });

    await writeChunks({ projectId: project.id, chunks, branch: input.branch, tx });

    await reportsStore.createReport({
      input: {
        id: reportId,
        projectId: project.id,
        title: extractReportTitle(generatedReport, input.repository),
        originalMarkdown: generatedReport,
        editableMarkdown: generatedReport,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        branch: input.branch,
        customInstructions: input.customInstructions?.trim() || null,
      },
      tx,
    });

    await reportCommitsStore.insertReportCommits({
      reportId,
      commitShas: commits.map((c) => c.sha),
      tx,
    });
  });

  void embedNewChunks(project.id).catch((err: any) => {
    console.warn("Embedding sync failed (will be retried by backfill):", err?.message ?? err);
  });

  return { reportId, projectId: project.id };
}

export async function updateReportUseCase(input: {
  reportId: string;
  editableMarkdown: string;
}) {
  const updated = await reportsStore.updateReportMarkdown({
    id: input.reportId,
    editableMarkdown: input.editableMarkdown,
  });
  if (!updated) {
    throw new ReportNotFoundError();
  }
  return {
    id: updated.id,
    editableMarkdown: updated.editableMarkdown,
    updatedAt: updated.updatedAt,
  };
}

export async function replyToReportUseCase(input: {
  reportId: string;
  reply: string;
  model?: string;
  provider?: string;
}) {
  const report = await reportsStore.getReport({ id: input.reportId });
  if (!report) {
    throw new ReportNotFoundError();
  }

  const chunks = await reportCommitsStore.listCommitsForReport({
    reportId: report.id,
    projectId: report.projectId,
    branch: report.branch,
  });
  const limitedCommits = chunks.slice(0, MAX_LIMIT).map((c) => ({ message: c.commitMessage }));

  const cleanMarkdown = (report.originalMarkdown || "").trim();

  const customInstructions = report.customInstructions?.trim();
  const languageInstruction = getLanguageInstruction(customInstructions);
  const systemPrompt = buildSystemPrompt(customInstructions);

  const apiKey = input.provider ? await resolveApiKey(input.provider) : undefined;

  const project = await projectsStore.getProjectById({ id: report.projectId });

  const originalPrompt = buildReportPrompt({
    repository: project?.repositoryName ?? report.title,
    branch: report.branch,
    startDate: report.startDate.toISOString().slice(0, 10),
    endDate: report.endDate.toISOString().slice(0, 10),
    commits: limitedCommits,
    languageInstruction,
  });

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: originalPrompt },
  ];

  if (cleanMarkdown) {
    messages.push({ role: "assistant", content: cleanMarkdown });
  }

  messages.push({
    role: "user",
    content: buildRefinePrompt(input.reply),
  });

  let attempts = 0;
  const maxAttempts = 2;
  let lastError: unknown = null;
  let lastMarkdown = "";

  while (attempts < maxAttempts) {
    attempts++;

    const messagesWithRetry = attempts > 1
      ? [...messages, { role: "user" as const, content: `Your previous response did not follow the required structure. Follow the template exactly:\n\n${buildTemplateInstruction()}` }]
      : messages;

    let content: string;
    let finishReason: string | null | undefined;
    try {
      const result = await callAI({
        model: input.model || undefined,
        provider: input.provider,
        apiKey: apiKey || undefined,
        maxTokens: 4096,
        messages: messagesWithRetry,
      });
      content = result.content;
      finishReason = result.finishReason;
    } catch (error) {
      lastError = error;
      console.error(`AI reply call failed (attempt ${attempts}/${maxAttempts}):`, error);
      continue;
    }

    if (finishReason === "length") {
      console.warn(`Reply truncated by token limit (attempt ${attempts}/${maxAttempts})`);
      continue;
    }

    lastMarkdown = cleanResponse(content).trim();

    if (lastMarkdown.length > 50) {
      const validation = validateReportStructure(lastMarkdown);
      if (validation.valid) break;
      console.warn(`Reply structure invalid (attempt ${attempts}/${maxAttempts}):`, validation.errors);
    }

    if (attempts >= maxAttempts) {
      console.warn("Max retry attempts reached for reply");
    }
  }

  if (lastMarkdown.length <= 50) {
    if (lastError) {
      throw AIGenerationError.from(lastError);
    }
    throw new AIGenerationError(
      "AI failed to produce a valid reply after retries. Please try again.",
      500,
    );
  }

  await reportsStore.updateReportMarkdown({
    id: input.reportId,
    editableMarkdown: lastMarkdown,
  });

  return lastMarkdown;
}
