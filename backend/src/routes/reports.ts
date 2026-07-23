import { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { reports } from "../db/schema";

export async function listReports(
  req: FastifyRequest<{ Querystring: { projectId?: string } }>,
  reply: FastifyReply,
) {
  try {
    const projectIdParam = req.query.projectId;
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
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = req.params;

    if (!id) {
      return reply.status(400).send({ error: "ID is required" });
    }

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
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = req.params;
    const { editableMarkdown } = req.body as { editableMarkdown?: string };

    if (!editableMarkdown) {
      return reply.status(400).send({ error: "editableMarkdown is required" });
    }

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
