import { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { reports } from "../db/schema";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, buildRefinePrompt } from "../services/prompts";
import { callAI, cleanResponse } from "../services/ai";

const MAX_LIMIT = 100;

export async function replyToReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = req.params;
    const { reply: userReply, model } = req.body as { reply?: string; model?: string };

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

    const { content: rawContent } = await callAI({
      model: model || undefined,
      messages,
    });

    const updatedMarkdown = cleanResponse(rawContent)
      .replace(/\n*## Media[\s\S]*$/, "")
      .trim();

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
