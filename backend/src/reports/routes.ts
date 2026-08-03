import { randomUUID } from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import {
  reportInputBodySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  updateReportBodySchema,
  replyBodySchema,
} from "@/reports/schemas";
import { getGitProvider } from "@/shared/integrations/git-provider";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
  buildRefinePrompt,
  FALLBACK_REPORT,
} from "@/reports/prompts";
import { validateReportStructure, buildTemplateInstruction } from "@/reports/report-output";
import { callAI, cleanResponse } from "@/reports/ai";
import { resolveApiKey } from "@/credentials/services";
import { buildCommitChunks } from "@/projects/chunks";
import { embedNewChunks } from "@/projects/embed-chunks";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as reportsStore from "@/reports/stores/reports-store";
import { extractReportTitle, formatDate } from "@/shared/utils";

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

export async function listReports(
  req: FastifyRequest<{ Querystring: { projectId?: string } }>,
  reply: FastifyReply,
) {
  const query = listReportsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return reply.status(400).send({ error: query.error.flatten() });
  }

  try {
    const rows = await reportsStore.listReports(
      query.data.projectId ? { projectId: query.data.projectId } : undefined,
    );
    const projectIds = [...new Set(rows.map((r) => r.projectId))];
    const projects = await projectsStore.getProjectsByIds(projectIds);
    const projectById = new Map(projects.map((p) => [p.id, p]));

    return reply.send({
      reports: rows.map((report) => {
        const project = projectById.get(report.projectId);
        return {
          id: report.id,
          projectId: report.projectId,
          title: report.title,
          repositoryName: project?.repositoryName ?? "",
          branch: report.branch,
          startDate: formatDate(report.startDate),
          endDate: formatDate(report.endDate),
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return reply.status(500).send({ error: "Failed to fetch reports" });
  }
}

export async function getReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  try {
    const report = await reportsStore.getReport(params.data.id);
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const project = await projectsStore.getProjectById(report.projectId);

    return reply.send({
      id: report.id,
      projectId: report.projectId,
      title: report.title,
      repositoryName: project?.repositoryName ?? "",
      originalMarkdown: report.originalMarkdown,
      editableMarkdown: report.editableMarkdown,
      startDate: formatDate(report.startDate),
      endDate: formatDate(report.endDate),
      branch: report.branch,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      imageAssets: report.imageAssets ?? [],
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return reply.status(500).send({ error: "Failed to fetch report" });
  }
}

export async function updateReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  const body = updateReportBodySchema.safeParse(req.body);
  if (!body.success) {
    return reply.status(400).send({ error: body.error.flatten() });
  }

  try {
    const updated = await reportsStore.updateReportMarkdown(params.data.id, body.data.editableMarkdown);
    if (!updated) {
      return reply.status(404).send({ error: "Report not found" });
    }

    return reply.send({
      id: updated.id,
      editableMarkdown: updated.editableMarkdown,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return reply.status(500).send({ error: "Failed to update report" });
  }
}

export async function replyToReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const params = reportIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: params.error.flatten() });
    }

    const body = replyBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const { reply: userReply, model, provider } = body.data;

    if (!userReply || userReply.trim().length === 0) {
      return reply.status(400).send({ error: "reply is required" });
    }

    const report = await reportsStore.getReport(params.data.id);
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const chunks = await commitChunksStore.listCommitsForProject(report.projectId, {
      startDate: report.startDate,
      endDate: report.endDate,
    });
    const limitedCommits = chunks.slice(0, MAX_LIMIT).map((c) => ({ message: c.commitMessage }));

    const cleanMarkdown = (report.originalMarkdown || "")
      .replace(/\n*## Media[\s\S]*$/, "")
      .trim();

    const customInstructions = report.customInstructions?.trim();
    const languageInstruction = getLanguageInstruction(customInstructions);
    const systemPrompt = buildSystemPrompt(customInstructions);

    const apiKey = provider ? await resolveApiKey(provider) : undefined;

    const project = await projectsStore.getProjectById(report.projectId);

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
      content: buildRefinePrompt(userReply),
    });

    let attempts = 0;
    const maxAttempts = 2;
    let updatedMarkdown: string;

    while (attempts < maxAttempts) {
      attempts++;

      const messagesWithRetry = attempts > 1
        ? [...messages, { role: "user" as const, content: `Your previous response did not follow the required structure. Follow the template exactly:\n\n${buildTemplateInstruction()}` }]
        : messages;

      const { content: rawContent, finishReason } = await callAI({
        model: model || undefined,
        provider,
        apiKey: apiKey || undefined,
        maxTokens: 4096,
        messages: messagesWithRetry,
      });

      if (finishReason === "length") {
        console.warn("Reply truncated by token limit, retrying with fallback");
        continue;
      }

      updatedMarkdown = cleanResponse(rawContent)
        .replace(/\n*## Media[\s\S]*$/, "")
        .trim();

      if (updatedMarkdown.length > 50) {
        const validation = validateReportStructure(updatedMarkdown);
        if (validation.valid) break;
        console.warn(`Reply structure invalid (attempt ${attempts}/${maxAttempts}):`, validation.errors);
      }

      if (attempts >= maxAttempts) {
        console.warn("Max retry attempts reached for reply, using last generation as-is");
      }
    }

    updatedMarkdown ??= "";

    await reportsStore.updateReportMarkdown(params.data.id, updatedMarkdown);

    return reply.send({ report: updatedMarkdown });
  } catch (error: any) {
    console.error("Error replying to report:", error);
    if (error?.status === 429) {
      return reply.status(429).send({ error: "Rate limit reached. Please try again later." });
    }
    return reply.status(500).send({ error: "Failed to process reply" });
  }
}
