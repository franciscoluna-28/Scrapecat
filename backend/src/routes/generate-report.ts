import { randomUUID } from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { reportInputBodySchema } from "../schemas";
import { getGitProvider } from "../services/git-provider";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, FALLBACK_REPORT } from "../services/prompts";
import { extractReportTitle } from "../shared/utils";
import { callAI, cleanResponse } from "../services/ai";
import { validateReportStructure, buildTemplateInstruction } from "../schemas/report-output";
import { resolveApiKey } from "../services/credentials";
import { buildCommitChunks } from "../services/chunks";
import { embedNewChunks } from "../services/embed-chunks";
import * as projectsStore from "../db/stores/projects-store";
import * as commitChunksStore from "../db/stores/commit-chunks-store";
import * as reportsStore from "../db/stores/reports-store";

const MAX_LIMIT = 100;

export async function createReport(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = reportInputBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data.data;

    const fetchedCommits = await getGitProvider().listCommits(data.githubOwner, data.repository, {
      branch: data.branch,
      since: data.startDate,
      until: data.endDate,
      perPage: MAX_LIMIT,
    });

    if (fetchedCommits.length === 0) {
      return reply.status(400).send({
        error: "Cannot generate report: no commits found in the selected date range",
      });
    }

    const sortedCommits = [...fetchedCommits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, MAX_LIMIT);

    const provider = data.provider;
    const apiKey = provider ? await resolveApiKey(provider) : undefined;

    const project = await projectsStore.upsertProject({
      githubProjectId: data.githubProjectId,
      repositoryName: data.repository,
      defaultBranch: data.branch,
    });

    const existing = await commitChunksStore.getChunksByShas(
      project.id,
      limitedCommits.map((c) => c.sha),
    );

    const missingCommits = limitedCommits.filter((c) => !existing.has(c.sha));

    const chunks = await buildCommitChunks(
      getGitProvider(),
      data.githubOwner,
      data.repository,
      missingCommits,
    );
    await commitChunksStore.upsertCommitChunks(
      chunks.map((c) => ({ ...c, projectId: project.id })),
    );

    void embedNewChunks(project.id).catch((err: any) => {
      console.warn("Embedding sync failed (will be retried by backfill):", err?.message ?? err);
    });

    const customInstructions = data.customInstructions?.trim();
    const languageInstruction = getLanguageInstruction(customInstructions);
    const systemPrompt = buildSystemPrompt(customInstructions);

    const prompt = buildReportPrompt({
      repository: data.repository,
      branch: data.branch,
      startDate: data.startDate,
      endDate: data.endDate,
      commits: limitedCommits,
      languageInstruction,
    });

    let generatedReport = FALLBACK_REPORT;

    try {
      const maxAttempts = 2;
      for (let attempts = 1; attempts <= maxAttempts; attempts++) {
        const { content: rawContent, finishReason } = await callAI({
          model: data.model,
          provider,
          apiKey: apiKey || undefined,
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

        if (finishReason === "length") {
          console.warn(`Report truncated by token limit (attempt ${attempts}/${maxAttempts})`);
          continue;
        }

        const cleaned = cleanResponse(rawContent);
        if (cleaned.length > 50) {
          const validation = validateReportStructure(cleaned);
          if (validation.valid) {
            generatedReport = cleaned;
            break;
          }
          console.warn(`Report structure invalid (attempt ${attempts}/${maxAttempts}):`, validation.errors);
        }
        generatedReport = cleaned;
      }
    } catch (error) {
      console.error("AI call failed, storing fallback report:", error);
      generatedReport = FALLBACK_REPORT;
    }

    const reportId = randomUUID();

    await reportsStore.createReport({
      id: reportId,
      projectId: project.id,
      title: extractReportTitle(generatedReport, data.repository),
      originalMarkdown: generatedReport,
      editableMarkdown: generatedReport,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      branch: data.branch,
      customInstructions: customInstructions || null,
    });

    return reply.code(201).send({ reportId, projectId: project.id });
  } catch (error: any) {
    console.error("Error generating report:", error);
    if (error?.status === 404 || error?.status === 422) {
      return reply.status(400).send({
        error: "Branch or repository not found on GitHub. Check the branch name and repository access.",
      });
    }
    return reply.status(500).send({ error: "Failed to generate report" });
  }
}
