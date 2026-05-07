import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { reports } from "@/src/drizzle/schema";
import { nanoid } from "nanoid";
import { reportInputSchema } from "@/src/features/reports/schemas";
import { db } from "@/src/drizzle/client";
import { APP_CONFIG } from "@/src/shared/data/app";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data } = body;

    const validatedData = reportInputSchema.parse(data);

    if (validatedData.commits.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate report: no commits found in the selected date range" },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY in '/api/generate-report'" },
        { status: 500 }
      );
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const sortedCommits = [...validatedData.commits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    const systemPrompt =
      "You are a business analyst creating executive summaries based on actual commit data. Be factual and grounded only in the provided information. Avoid speculation or making up details not present in the data.";

    const prompt = `Repository: ${validatedData.repository}
Branch: ${validatedData.branch}
Date Range: ${validatedData.startDate} to ${validatedData.endDate}
Total Commits Analyzed: ${limitedCommits.length}

Recent commit activity (FACTUAL DATA ONLY):
${limitedCommits
  .map((commit) => `- ${commit.author}: ${commit.message}`)
  .join("\n")}

IMPORTANT: Base your summary ONLY on the commit messages and activity shown above. Do not invent features, metrics, or achievements not evident in the data.

Create a factual executive summary with:
1. Business impact (2-3 sentences) - based on actual commit patterns
2. Key achievements (3-4 bullet points) - only what's visible in commits
3. Productivity overview (2-3 sentences) - based on commit frequency and authors
4. Strategic insights (2-3 bullet points) - grounded in actual development activity

Use simple language. Be conservative and factual. Keep under 250 words.`;

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
      temperature: 0.2, // The lower the temperature, the less the AI will hallucinate. We cannot afford hallucinations working with commits.
      max_tokens: 400, // 400 tokens is enough for MVP stage.
    });

    const generatedReport = result.choices[0]?.message?.content || "";

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
      const fallbackReport =
        "# Executive Summary\n\n## Business Impact\nUnable to generate summary due to API rate limits. Please try again later.\n\n## Key Achievements\nReport generation temporarily unavailable.\n\n## Productivity Overview\nRate limit reached. Consider upgrading API plan for higher limits.\n\n## Strategic Insights\n- Wait a few minutes before retrying\n- Consider reducing data size for faster processing";

      return new Response(JSON.stringify({ report: fallbackReport }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
