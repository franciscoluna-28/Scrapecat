import { NextResponse } from "next/server";
import { OpenRouter } from "@openrouter/sdk";
import { nanoid } from "nanoid";
import { APP_CONFIG } from "@/src/shared/constants/app";
import {
  buildSystemPrompt,
  FALLBACK_REPORT,
} from "@/src/shared/constants/prompts";
import { createReport } from "@/src/store/demo-reports-store";

const reportInputSchema = {
  parse: (data: any) => data,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data } = body;
    const validatedData = data;

    if (validatedData.commits.length === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot generate report: no commits found in the selected date range",
        },
        { status: 400 },
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 },
      );
    }

    const openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      httpReferer: "https://github.com/anthropics/fabric",
      appTitle: "Fabric Demo",
    });

    const sortedCommits = [...validatedData.commits].sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    const systemPrompt = buildSystemPrompt(validatedData.customInstructions?.trim());

    const commitLines = limitedCommits.map((c: any) => `- ${c.message}`).join("\n");
    const prompt = [
      `Context: Technical activity log for ${validatedData.repository} (${validatedData.branch}) from ${validatedData.startDate} to ${validatedData.endDate}.`,
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

    const result = await openRouter.chat.send({
      chatRequest: {
        model: "google/gemma-4-26b-a4b-it:free",
        messages: [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: prompt },
        ],
        temperature: 0.1,
        maxTokens: 1024,
      },
    });

    const rawContent =
      (typeof (result as any).choices?.[0]?.message?.content === "string"
        ? (result as any).choices[0].message.content
        : "") || "";
    const generatedReport = rawContent
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
      .replace(/^-\s*\n(?=[^\s-])/gm, "- ")
      .trim();

    const reportId = nanoid();

    const now = new Date();
    createReport({
      id: reportId,
      githubProjectId: validatedData.githubProjectId,
      githubRepositoryName: validatedData.repository,
      originalMarkdown: generatedReport,
      editableMarkdown: generatedReport,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      branch: validatedData.branch,
      sourceCommits: validatedData.commits,
      sourceCommitsUpdatedAt: now,
      customInstructions: validatedData.customInstructions?.trim() || null,
    });

    return new Response(
      JSON.stringify({ reportId, report: generatedReport }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[demo] Error generating report:", error);
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 429
    ) {
      return new Response(JSON.stringify({ report: FALLBACK_REPORT }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
