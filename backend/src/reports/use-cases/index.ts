import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { resolveApiKey } from "@/credentials/services";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { getAISettings } from "@/settings/services";
import { ingestCommits } from "@/repositories/ingest";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import { type CreateReportInput } from "@/reports/schemas";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
  type ReportCommit,
} from "@/reports/prompts";
import { validateReportStructure, buildTemplateInstruction } from "@/reports/report-output";
import { callAI, cleanResponse } from "@/reports/ai";
import { extractReportTitle } from "@/shared/utils";

export type { CreateReportInput };

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
  commits: ReportCommit[];
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
    const attemptStart = performance.now();
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
      logger.warn(
        {
          attempt: attempts,
          maxAttempts,
          provider: opts.provider,
          model: opts.input.model || opts.model,
          durationMs: Math.round(performance.now() - attemptStart),
          err: (error as Error)?.message ?? String(error),
        },
        "AI report call failed",
      );
      continue;
    }

    const attemptMs = Math.round(performance.now() - attemptStart);
    logger.info(
      {
        attempt: attempts,
        maxAttempts,
        provider: opts.provider,
        model: opts.input.model || opts.model,
        finishReason,
        responseLength: content.length,
        durationMs: attemptMs,
      },
      "AI report call complete",
    );

    if (finishReason === "length") {
      logger.warn(
        { attempt: attempts, maxAttempts },
        "Report truncated by token limit",
      );
      continue;
    }

    const cleaned = cleanResponse(content);
    if (cleaned.length > 50) {
      const validation = validateReportStructure(cleaned);
      if (validation.valid) {
        return cleaned;
      }
      logger.warn(
        { attempt: attempts, maxAttempts, errors: validation.errors },
        "Report structure invalid",
      );
    }
    lastReport = cleaned;
  }

  if (lastError) {
    throw AIGenerationError.from(lastError);
  }
  logger.error(
    { provider: opts.provider, model: opts.input.model || opts.model, lastReport },
    "AI never produced a valid report after retries",
  );
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

  const { project } = await timed(
    "report.upsertProject",
    { provider, model, repo: input.repository, branch: input.branch },
    () =>
      projectsStore.upsertProject({
        input: {
          gitProvider: input.gitProvider,
          providerProjectId: input.providerProjectId,
          providerOwner: input.providerOwner,
          repositoryName: input.repository,
          defaultBranch: input.branch,
        },
      }),
  );

  // Batch-ingest the report window from the local git archive (clone + diffs +
  // LLM summaries), then read the window's commits straight from Postgres.
  const ingestResult = await timed(
    "report.ingestCommits",
    { provider, model, repo: input.repository, branch: input.branch },
    () =>
      ingestCommits({
        owner: input.providerOwner,
        repo: input.repository,
        branch: input.branch,
        projectId: project.id,
        startDate: startOfDayUtc(input.startDate),
        endDate: endOfDayUtc(input.endDate),
      }),
  );

  const storedRows = await timed(
    "report.listCommitsForProject",
    { repo: input.repository, branch: input.branch },
    () =>
      commitChunksStore.listCommitsForProject({
        projectId: project.id,
        branch: input.branch,
        startDate: startOfDayUtc(input.startDate),
        endDate: endOfDayUtc(input.endDate),
      }),
  );
  const commits: ReportCommit[] = storedRows.map((r) => ({
    sha: r.commitSha,
    message: r.commitMessage,
    summary: r.diffSummary,
    files: r.metadata?.fileStats ?? [],
    filesChanged: r.metadata?.filesChanged?.length ?? 0,
    additions: r.metadata?.additions ?? 0,
    deletions: r.metadata?.deletions ?? 0,
    commitUrl: r.metadata?.commitUrl ?? null,
    flagged: r.metadata?.validation?.status === "flagged",
  }));

  if (commits.length === 0) {
    throw new NoCommitsError();
  }

  const generatedReport = await timed(
    "report.generateReport",
    { provider, model, commits: commits.length },
    () =>
      generateReport({
        input,
        commits,
        apiKey,
        provider,
        model,
      }),
  );

  const reportId = randomUUID();

  await timed(
    "report.store",
    { repo: input.repository, branch: input.branch, commits: commits.length },
    () =>
      db.transaction(async (tx) => {
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
      }),
  );

  logger.info(
    {
      reportId,
      projectId: project.id,
      repo: input.repository,
      branch: input.branch,
      provider,
      model,
      commitsFound: ingestResult.commitsFound,
      chunksWritten: ingestResult.chunksWritten,
    },
    "report generation complete",
  );

  return { reportId, projectId: project.id };
}
