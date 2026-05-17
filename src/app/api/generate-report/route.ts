import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { reports } from "@/src/drizzle/schema";
import { nanoid } from "nanoid";
import { reportInputSchema } from "@/src/features/reports/schemas";
import { db } from "@/src/drizzle/client";
import { APP_CONFIG } from "@/src/shared/constants/app";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, FALLBACK_REPORT } from "@/src/shared/constants/prompts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data } = body;

    const validatedData = reportInputSchema.parse(data);

    if (validatedData.commits.length === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot generate report: no commits found in the selected date range",
        },
        { status: 400 },
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY in '/api/generate-report'" },
        { status: 500 },
      );
    }

    // Change the provider if needed
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const sortedCommits = [...validatedData.commits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    const customInstructions = validatedData.customInstructions?.trim();

    const languageInstruction = getLanguageInstruction(customInstructions);
    const systemPrompt = buildSystemPrompt(customInstructions);

    const prompt = buildReportPrompt({
      repository: validatedData.repository,
      branch: validatedData.branch,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      commits: limitedCommits,
      languageInstruction,
    });

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawContent = result.choices[0]?.message?.content || "";

    // Strip <thinking> tags used for Chain of Thought reasoning
    const generatedReport = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();

    // Save report to database
    const reportId = nanoid();
    const now = new Date();

    await db.insert(reports).values({
      id: reportId,
      githubProjectId: parseInt(validatedData.repository) || 0,
      githubRepositoryName: validatedData.repository,
      originalMarkdown: generatedReport,
      editableMarkdown: generatedReport,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      branch: validatedData.branch,
      createdAt: now,
      updatedAt: now,
      sourceCommitsUpdatedAt: now,
      sourceCommits: validatedData.commits,
      customInstructions: customInstructions || null,
    });

    return new Response(
      JSON.stringify({
        reportId,
        report: generatedReport,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error generating report:", error);

    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 429
    ) {
      const fallbackReport = FALLBACK_REPORT;

      return new Response(JSON.stringify({ report: fallbackReport }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
