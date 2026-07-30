import { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { reports } from "../db/schema";
import { listReportsQuerySchema, reportIdParamsSchema, updateReportBodySchema } from "../schemas";

export async function listReports(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const parsed = listReportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const projectIdParam = parsed.data.projectId;
    const projectId = projectIdParam ? Number(projectIdParam) : undefined;

    const [distinctProjects, allReports] = await Promise.all([
      db
        .select({ id: reports.githubProjectId, name: reports.githubRepositoryName })
        .from(reports)
        .groupBy(reports.githubProjectId)
        .orderBy(reports.githubRepositoryName),
      db.query.reports.findMany({
        where: projectId ? eq(reports.githubProjectId, projectId) : undefined,
        orderBy: (r, { desc }) => [desc(r.updatedAt)],
      }),
    ]);

    return reply.send({
      reports: allReports.map((report) => ({
        id: report.id,
        githubRepositoryName: report.githubRepositoryName,
        githubProjectId: report.githubProjectId,
        startDate: report.startDate,
        endDate: report.endDate,
        branch: report.branch,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      distinctProjects,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return reply.status(500).send({ error: "Failed to fetch reports" });
  }
}

export async function getReport(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const parsed = reportIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "ID is required" });
    }

    const { id } = parsed.data;

    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    });

    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    return reply.send({
      id: report.id,
      originalMarkdown: report.originalMarkdown,
      editableMarkdown: report.editableMarkdown,
      startDate: report.startDate,
      endDate: report.endDate,
      branch: report.branch,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      githubProjectId: report.githubProjectId,
      githubRepositoryName: report.githubRepositoryName,
      sourceCommits: report.sourceCommits || [],
      sourceCommitsUpdatedAt: report.sourceCommitsUpdatedAt || null,
      imageAssets: report.imageAssets || [],
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return reply.status(500).send({ error: "Failed to fetch report" });
  }
}

export async function updateReport(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const paramsParsed = reportIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "ID is required" });
    }

    const bodyParsed = updateReportBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.flatten() });
    }

    const { id } = paramsParsed.data;
    const { editableMarkdown } = bodyParsed.data;

    const updated = await db
      .update(reports)
      .set({ editableMarkdown, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();

    if (updated.length === 0) {
      return reply.status(404).send({ error: "Report not found" });
    }

    return reply.send({
      id: updated[0].id,
      editableMarkdown: updated[0].editableMarkdown,
      updatedAt: updated[0].updatedAt,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return reply.status(500).send({ error: "Failed to update report" });
  }
}
