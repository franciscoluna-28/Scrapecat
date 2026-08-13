import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { env } from "@/config/env";
import { resolveApiKey } from "@/credentials/services";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { getAISettings } from "@/settings/services";
import { enqueueSync, ensureSynced } from "@/projects/sync-service";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import { reportInputSchema } from "@/reports/schemas";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
} from "@/reports/prompts";
import { validateReportStructure, buildTemplateInstruction } from "@/reports/report-output";
import { callAI, cleanResponse } from "@/reports/ai";
import { extractReportTitle } from "@/shared/utils";

export type CreateReportInput = z.infer<typeof reportInputSchema>;

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

export class NoCommitsError extends Error {
  readonly status = 400;
  constructor() {
    super("Cannot generate report: no commits found in the selected date range");
  }
}

export class ProviderKeyError extends Error {
  readonly status = 400;
  constructor(provider: string) {
    const envKey = getProviderConfig(provider)?.envKey ?? "the provider's env key";
    super(
      `No API key configured for AI provider "${provider}". Add one in Settings or set ${envKey}.`,
    );
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

async function generateReport(opts: {
  input: CreateReportInput;
  commits: { message: string }[];
  apiKey?: string | null;
  provider?: string;
  model?: string;
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
        model: opts.input.model || opts.model,
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
  // Never start report generation (not even the sync) without a valid AI key.
  // Fail fast with a clear error instead of burning sync work + AI retries.
  const settings = await getAISettings();
  const provider = input.provider || settings.reportProvider;
  const model = input.model || settings.reportModel;
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    throw new ProviderKeyError(provider);
  }
  const storedKey = await resolveApiKey(provider);
  const apiKey =
    storedKey ||
    (env as unknown as Record<string, string>)[providerConfig.envKey] ||
    "";
  if (!apiKey) {
    throw new ProviderKeyError(provider);
  }

  const { project, created } = await projectsStore.upsertProject({
    input: {
      gitProvider: input.gitProvider,
      providerProjectId: input.providerProjectId,
      providerOwner: input.providerOwner,
      repositoryName: input.repository,
      defaultBranch: input.branch,
    },
  });

  // Eager full backfill on project creation — the worker owns it from here.
  if (created) {
    await enqueueSync({ projectId: project.id, branch: input.branch });
  }

  // Delegate to the sync worker and wait until the store covers the report
  // window (in UTC), then read the window's commits straight from Postgres.
  await ensureSynced({
    projectId: project.id,
    branch: input.branch,
    needByUtc: endOfDayUtc(input.endDate),
  });

  const storedRows = await commitChunksStore.listCommitsForProject({
    projectId: project.id,
    branch: input.branch,
    startDate: startOfDayUtc(input.startDate),
    endDate: endOfDayUtc(input.endDate),
  });
  const commits = storedRows.map((r) => ({
    sha: r.commitSha,
    message: r.commitMessage,
    author: r.author ?? "",
    date: r.committedAt.toISOString(),
  }));

  if (commits.length === 0) {
    throw new NoCommitsError();
  }

  const generatedReport = await generateReport({
    input,
    commits,
    apiKey,
    provider,
    model,
  });

  const reportId = randomUUID();

  await db.transaction(async (tx) => {
    await reportsStore.createReport({
      input: {
        id: reportId,
        projectId: project.id,
        title: extractReportTitle(generatedReport, input.repository),
        originalMarkdown: generatedReport,
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

  return { reportId, projectId: project.id };
}
