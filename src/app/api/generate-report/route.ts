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

    // Modify according to your needs
    const systemPrompt =
      "You are a Senior Product Manager working with non-technical stakeholders. Your task is to transform technical git commits into a high-level Product Update. Group related technical tasks into functional categories (e.g., Infrastructure, User Experience, Data Reliability). Use professional, outcome-oriented language. Remove individual names and focus on the 'System' or 'Platform' achievements.";

    // Feel free to modify this prompt to better fit your needs. I built it for my Product Manager to understand what's been done in the last week.
    // Future use cases: technical, engineering, marketing, operations, etc.
    const prompt = `
Context: Technical activity log for ${validatedData.repository} (${validatedData.branch}) from ${validatedData.startDate} to ${validatedData.endDate}.

Raw Activity Data:
${limitedCommits.map((commit) => `- ${commit.message}`).join("\n")} 

Task: Synthesize this data into a "Product Update" style report. 

Guidelines:
1. DO NOT mention developer names or commit counts.
2. GROUP small technical changes into 3-4 high-level functional categories (e.g., "Feature Development", "Infrastructure & Performance", "UI Refinement", "Data Layer").
3. TRANSLATE technical actions into product value (e.g., instead of "added SWR", use "Implemented reactive data fetching for improved UI snappiness").
4. BE CONCISE. Use bullet points that start with a strong verb.
5. Prioritize features and fix commits.
6. ABSOLUTELY NO SEPARATORS: Do not use horizontal rules (---, ***), dividers, or any visual separator elements.

Constraints:
- Constraint: Avoid mentioning technical details like libraries or frameworks, focus on the business logic and user impact.
- Constraint: Use 'Engineering Updates' style. Avoid flowery adjectives like 'groundbreaking' or 'revolutionary'. Stick to neutral, high-leverage verbs (Optimized, Scaled, Standardized, Integrated).
- Constraint: Maximum 300 words if there are more than 5 commits.
- Constraint: Maximum 4 categories.
- Constraint: Use markdown format.
- Constraint: If the commits are less than 5, maximum 200 words and 2 categories.

Structure:
- Title: Product Update - [Project Name]
- 3-4 Categorized Sections (with 2-4 bullet points each) 
- Summary of Strategic Direction as a H3 tag (1-3 sentences)
- Match the changes according to the commits and their dates. For example, if we did not have changes in a category, do not include it.
`;

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
      temperature: 0.1, // The lower the temperature, the less the AI will hallucinate. We cannot afford hallucinations working with commits.
      max_tokens: 500,
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
      sourceCommitsUpdatedAt: now,
      sourceCommits: validatedData.commits
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
      { status: 500 },
    );
  }
}
