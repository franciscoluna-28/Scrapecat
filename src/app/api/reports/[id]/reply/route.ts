import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/drizzle/client";
import { reports } from "@/src/drizzle/schema";
import Groq from "groq-sdk";
import { APP_CONFIG } from "@/src/shared/data/app";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { reply } = await request.json();

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

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500 },
      );
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const sortedCommits = [...(report.sourceCommits || [])].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    const customInstructions = report.customInstructions?.trim();

    const languageInstruction = customInstructions
      ? `IMPORTANT: Detect the language of the user's instructions below and write the entire report in that same language. For Spanish, use natural phrasing like "se ha implementado", "se ha optimizado", "se ha creado" (avoid direct translations of English verbs).`
      : "Write the report in English.";

    const systemPrompt = [
      "You are a Senior Product Manager working with non-technical stakeholders. Your task is to transform technical git commits into a high-level Product Update. Group related technical tasks into functional categories (e.g., Infrastructure, User Experience, Data Reliability). Use professional, outcome-oriented language. Remove individual names and focus on the 'System' or 'Platform' achievements.",
      customInstructions ? `\nUser Specifications:\n${customInstructions}\n\nDuring your analysis, carefully consider these specifications. They represent the user's priorities and should guide how you categorize and frame the updates.` : "",
    ].filter(Boolean).join("\n");

    const originalPrompt = `
Context: Technical activity log for ${report.githubRepositoryName} (${report.branch}) from ${report.startDate} to ${report.endDate}.

Raw Activity Data:
${limitedCommits.map((commit: any) => `- ${commit.message}`).join("\n")} 

Task: Synthesize this data into a "Product Update" style report.

${languageInstruction}

Before writing the final report, reason step-by-step inside <thinking> tags:
<thinking>
1. Analyze each commit message and identify the core technical change.
2. Group related changes into functional categories, considering any user specifications provided.
3. For each category, determine the product-level impact of the changes.
4. Verify the report structure matches the required format.
5. Ensure all user specifications have been addressed.
</thinking>

After closing the thinking tag, output ONLY the final markdown report with no additional commentary.

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

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: originalPrompt },
    ];

    if (report.originalMarkdown) {
      messages.push({ role: "assistant", content: report.originalMarkdown });
    }

    messages.push({
      role: "user",
      content: `Refine the report based on this feedback:\n${reply}\n\nFirst reason inside <thinking> tags, then output ONLY the updated markdown report.`,
    });

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawContent = result.choices[0]?.message?.content || "";

    const updatedMarkdown = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();

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
