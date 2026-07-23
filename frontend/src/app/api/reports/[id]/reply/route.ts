import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/drizzle/client";
import { reports } from "@/src/drizzle/schema";
import { APP_CONFIG } from "@/src/shared/constants/app";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, buildRefinePrompt } from "@/src/shared/constants/prompts";
import { callAI, cleanResponse } from "@/src/shared/services/ai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { reply, model } = await request.json();

    if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
      return NextResponse.json(
        { error: "reply is required" },
        { status: 400 },
      );
    }

    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const sortedCommits = [...(report.sourceCommits || [])].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    // Strip any embedded ## Media section from the stored markdown before sending to AI.
    // This handles backward compatibility with reports generated before images were separated.
    const cleanMarkdown = (report.originalMarkdown || "").replace(/\n*## Media[\s\S]*$/, "").trim();

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
      content: buildRefinePrompt(reply),
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
      .set({
        editableMarkdown: updatedMarkdown,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    return NextResponse.json({
      report: updatedMarkdown,
    });
  } catch (error: unknown) {
    console.error("Error replying to report:", error);

    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 429
    ) {
      return NextResponse.json(
        { error: "Rate limit reached. Please try again later." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to process reply" },
      { status: 500 },
    );
  }
}
