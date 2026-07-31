import { FastifyRequest, FastifyReply } from "fastify";
import { reportIdParamsSchema, replyBodySchema } from "../schemas";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, buildRefinePrompt } from "../services/prompts";
import { callAI, cleanResponse } from "../services/ai";
import { validateReportStructure, buildTemplateInstruction } from "../schemas/report-output";
import { resolveApiKey } from "../services/credentials";
import * as reportsStore from "../db/stores/reports-store";
import * as commitChunksStore from "../db/stores/commit-chunks-store";
import * as projectsStore from "../db/stores/projects-store";

const MAX_LIMIT = 100;

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

      const { content: rawContent } = await callAI({
        model: model || undefined,
        provider,
        apiKey: apiKey || undefined,
        messages: messagesWithRetry,
      });

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
