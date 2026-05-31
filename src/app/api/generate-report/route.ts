import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { reports } from "@/src/drizzle/schema";
import { nanoid } from "nanoid";
import { reportInputSchema } from "@/src/features/reports/schemas";
import { db } from "@/src/drizzle/client";
import { APP_CONFIG } from "@/src/shared/constants/app";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, FALLBACK_REPORT } from "@/src/shared/constants/prompts";
import { getPullRequestForCommit } from "@/src/shared/services/github";
import { extractImagesFromPrBody } from "@/src/shared/lib/utils";
import { uploadImagesToR2 } from "@/src/shared/lib/r2";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data } = body;
    const validatedData = reportInputSchema.parse(data);

    if (validatedData.commits.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate report: no commits found in the selected date range" },
        { status: 400 },
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const sortedCommits = [...validatedData.commits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, APP_CONFIG.commits.MAX_LIMIT);

    // Fetch PR bodies + PR numbers for each commit
    const prCache = new Map<string, { body: string | null; number: number }>();
    await Promise.allSettled(
      limitedCommits.map(async (commit) => {
        if (prCache.has(commit.sha)) return;
        const pr = await getPullRequestForCommit(
          validatedData.githubOwner,
          validatedData.repository,
          commit.sha,
        );
        prCache.set(commit.sha, { body: pr?.body ?? null, number: pr?.number ?? 0 });
      }),
    );

    const enrichedCommits = limitedCommits.map((c) => {
      const p = prCache.get(c.sha);
      if (p) console.log(`[Report] ${c.sha.slice(0, 7)} → PR #${p.number}`);
      else console.log(`[Report] ${c.sha.slice(0, 7)} → no PR found`);
      return { ...c, prBody: p?.body ?? null, prNumber: p?.number ?? 0 };
    });

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
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawContent = result.choices[0]?.message?.content || "";
    const generatedReport = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();

    // Upload images from PR bodies to R2
    const reportId = nanoid();
    const images: { url: string; commitSha: string; commitMessage: string; prNumber: number }[] = [];

    for (const commit of enrichedCommits) {
      if (!commit.prBody) continue;
      const extracted = extractImagesFromPrBody(commit.prBody, commit.sha, commit.message);
      for (const img of extracted) {
        images.push({ url: img.url, commitSha: img.commitSha, commitMessage: img.commitMessage, prNumber: commit.prNumber });
      }
    }

    const assets = await uploadImagesToR2(images, reportId, validatedData.githubOwner, validatedData.repository);
    const reportWithMedia = assets.length > 0
      ? `${generatedReport}\n\n## Media\n\n${assets.map((a) => `![](${a.r2Url})`).join("\n\n")}`
      : generatedReport;

    // Save to DB
    const now = new Date();
    await db.insert(reports).values({
      id: reportId,
      githubProjectId: parseInt(validatedData.repository) || 0,
      githubRepositoryName: validatedData.repository,
      originalMarkdown: reportWithMedia,
      editableMarkdown: reportWithMedia,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      branch: validatedData.branch,
      createdAt: now,
      updatedAt: now,
      sourceCommitsUpdatedAt: now,
      sourceCommits: enrichedCommits,
      imageAssets: assets.length > 0 ? assets : [],
      customInstructions: customInstructions || null,
    });

    return new Response(
      JSON.stringify({ reportId, report: reportWithMedia }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating report:", error);
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 429) {
      return new Response(JSON.stringify({ report: FALLBACK_REPORT }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
