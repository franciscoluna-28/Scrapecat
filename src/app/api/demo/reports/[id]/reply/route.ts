import { NextRequest, NextResponse } from "next/server";
import { getReport, updateReport } from "@/src/store/demo-reports-store";
import { APP_CONFIG } from "@/src/shared/constants/app";
import { buildSystemPrompt } from "@/src/shared/constants/prompts";
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

    const report = getReport(id);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const sortedCommits = [...(report.sourceCommits || [])].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    const cleanMarkdown = (report.originalMarkdown || "")
      .replace(/\n*## Media[\s\S]*$/, "")
      .trim();

    const systemPrompt = buildSystemPrompt(report.customInstructions?.trim());

    const commitLines = limitedCommits.map((c: any) => `- ${c.message}`).join("\n");
    const originalPrompt = [
      `Context: Technical activity log for ${report.githubRepositoryName} (${report.branch}) from ${report.startDate} to ${report.endDate}.`,
      "",
      "Raw Activity Data:",
      commitLines,
      "",
      `Task: Write a concise product update report covering the changes below.`,
      `Group changes into functional categories like "Feature Development", "Infrastructure & Performance", "User Experience", "Data Layer".`,
      `Use bullet points starting with "- ".`,
      `Write the report in English.`,
      `Maximum 300 words.`,
      "",
      `Format:`,
      `- Title: Product Update - [Project Name]`,
      `- 3-4 categorized H2 sections (## Category Name)`,
      `- Bullet points under each section using "- " syntax, one per line`,
      `- End with a "### Strategic Direction" section (1-3 sentences)`,
    ].join("\n");

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: originalPrompt },
    ];

    if (cleanMarkdown) {
      messages.push({ role: "assistant" as const, content: cleanMarkdown });
    }

    messages.push({
      role: "user" as const,
      content: `Refine the report based on this feedback:\n${reply}\n\nOutput ONLY the updated markdown report with no additional commentary.`,
    });

    const { content: rawContent } = await callAI({
      model: model || undefined,
      messages,
    });

    const updatedMarkdown = cleanResponse(rawContent)
      .replace(/\n*## Media[\s\S]*$/, "")
      .trim();

    updateReport(id, { editableMarkdown: updatedMarkdown });

    return NextResponse.json({
      report: updatedMarkdown,
    });
  } catch (error: unknown) {
    console.error("[demo] Error replying to report:", error);

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
