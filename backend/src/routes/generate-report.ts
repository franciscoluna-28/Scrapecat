import { FastifyRequest, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import { reportInputBodySchema } from "../schemas";
import { db } from "../db/client";
import { reports } from "../db/schema";
import { getGitProvider } from "../services/git-provider";
import { buildSystemPrompt, getLanguageInstruction, buildReportPrompt, FALLBACK_REPORT } from "../services/prompts";
import { extractImagesFromPrBody } from "../shared/utils";
import { uploadImagesToR2 } from "../services/r2";
import { callAI, cleanResponse } from "../services/ai";
import { validateReportStructure, buildTemplateInstruction } from "../schemas/report-output";
import { resolveApiKey } from "../services/credentials";

const MAX_LIMIT = 100;

export async function createReport(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = reportInputBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data.data;

    const fetchedCommits = await getGitProvider().listCommits(data.githubOwner, data.repository, {
      branch: data.branch,
      since: data.startDate,
      until: data.endDate,
      perPage: MAX_LIMIT,
    });

    if (fetchedCommits.length === 0) {
      return reply.status(400).send({
        error: "Cannot generate report: no commits found in the selected date range",
      });
    }

    const sortedCommits = [...fetchedCommits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const limitedCommits = sortedCommits.slice(0, MAX_LIMIT);

    let enrichedCommits: Array<typeof limitedCommits[number] & { prBody: string | null; prNumber: number }>;

    if (data.quickMode) {
      enrichedCommits = limitedCommits.map((c) => ({ ...c, prBody: null, prNumber: 0 }));
    } else {
      const prCache = new Map<string, { body: string | null; number: number }>();
      await Promise.allSettled(
        limitedCommits.map(async (commit) => {
          if (prCache.has(commit.sha)) return;
          const pr = await getGitProvider().getPullRequestForCommit(data.githubOwner, data.repository, commit.sha);
          prCache.set(commit.sha, { body: pr?.body ?? null, number: pr?.number ?? 0 });
        }),
      );

      enrichedCommits = limitedCommits.map((c) => {
        const p = prCache.get(c.sha);
        return { ...c, prBody: p?.body ?? null, prNumber: p?.number ?? 0 };
      });
    }

    const customInstructions = data.customInstructions?.trim();
    const languageInstruction = getLanguageInstruction(customInstructions);
    const systemPrompt = buildSystemPrompt(customInstructions);

    const provider = data.provider;
    const apiKey = provider ? await resolveApiKey(provider) : undefined;

    const prompt = buildReportPrompt({
      repository: data.repository,
      branch: data.branch,
      startDate: data.startDate,
      endDate: data.endDate,
      commits: limitedCommits,
      languageInstruction,
    });

    let attempts = 0;
    const maxAttempts = 2;
    let generatedReport: string;

    while (attempts < maxAttempts) {
      attempts++;
      const { content: rawContent } = await callAI({
        model: data.model,
        provider,
        apiKey: apiKey || undefined,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: attempts > 1 ? `${prompt}\n\nYour previous response did not follow the required structure. Follow the template exactly:\n\n${buildTemplateInstruction()}` : prompt },
        ],
      });

      generatedReport = cleanResponse(rawContent);

      if (generatedReport.length > 50) {
        const validation = validateReportStructure(generatedReport);
        if (validation.valid) break;
        console.warn(`Report structure invalid (attempt ${attempts}/${maxAttempts}):`, validation.errors);
      }

      if (attempts >= maxAttempts) {
        console.warn("Max retry attempts reached, using last generation as-is");
      }
    }

    generatedReport ??= FALLBACK_REPORT;

    const reportId = nanoid();
    let assets: Awaited<ReturnType<typeof uploadImagesToR2>> = [];

    if (!data.quickMode) {
      const images: { url: string; commitSha: string; commitMessage: string; prNumber: number }[] = [];
      for (const commit of enrichedCommits) {
        if (!commit.prBody) continue;
        const extracted = extractImagesFromPrBody(commit.prBody, commit.sha, commit.message);
        for (const img of extracted) {
          images.push({ url: img.url, commitSha: img.commitSha, commitMessage: img.commitMessage, prNumber: commit.prNumber });
        }
      }
      assets = await uploadImagesToR2(images, reportId, data.githubOwner, data.repository);
    }

    const now = new Date();
    await db.insert(reports).values({
      id: reportId,
      githubProjectId: data.githubProjectId,
      githubRepositoryName: data.repository,
      originalMarkdown: generatedReport,
      editableMarkdown: generatedReport,
      startDate: data.startDate,
      endDate: data.endDate,
      branch: data.branch,
      createdAt: now,
      updatedAt: now,
      sourceCommitsUpdatedAt: now,
      sourceCommits: enrichedCommits,
      imageAssets: assets.length > 0 ? assets : [],
      customInstructions: customInstructions || null,
    });

    return reply.code(201).send({ reportId, report: generatedReport });
  } catch (error: any) {
    console.error("Error generating report:", error);
    if (error?.status === 429) {
      return reply.send({ report: FALLBACK_REPORT });
    }
    return reply.status(500).send({ error: "Failed to generate report" });
  }
}
