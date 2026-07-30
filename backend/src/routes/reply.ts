import { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { reports } from "../db/schema";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, buildRefinePrompt } from "../services/prompts";
import { callAI, cleanResponse } from "../services/ai";
import { validateReportStructure, buildTemplateInstruction } from "../schemas/report-output";
import { resolveApiKey } from "../services/credentials";
import { reportIdParamsSchema, replyBodySchema } from "../schemas";

const MAX_LIMIT = 100;

export async function replyToReport(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const paramsParsed = reportIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "ID is required" });
    }
    const { id } = paramsParsed.data;

    const bodyParsed = replyBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.flatten() });
    }
    const { reply: userReply, model, provider } = bodyParsed.data;

    if (!userReply || typeof userReply !== "string" || userReply.trim().length === 0) {
      return reply.status(400).send({ error: "reply is required" });
    }

    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    });

    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const sortedCommits = [...(report.sourceCommits || [])].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, MAX_LIMIT);

    const cleanMarkdown = (report.originalMarkdown || "")
      .replace(/\n*## Media[\s\S]*$/, "")
      .trim();

    const customInstructions = report.customInstructions?.trim();
    const languageInstruction = getLanguageInstruction(customInstructions);
    const systemPrompt = buildSystemPrompt(customInstructions);

    const apiKey = provider ? await resolveApiKey(provider) : undefined;

    const originalPrompt = buildReportPrompt({
      repository: report.githubRepositoryName,
      branch: report.branch,
      startDate: report.startDate,
      endDate: report.endDate,
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
        provider: provider,
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

    await db
      .update(reports)
      .set({ editableMarkdown: updatedMarkdown, updatedAt: new Date() })
      .where(eq(reports.id, id));

    return reply.send({ report: updatedMarkdown });
  } catch (error: any) {
    console.error("Error replying to report:", error);
    if (error?.status === 429) {
      return reply.status(429).send({ error: "Rate limit reached. Please try again later." });
    }
    return reply.status(500).send({ error: "Failed to process reply" });
  }
}
