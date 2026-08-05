import { FastifyRequest, FastifyReply } from "fastify";
import {
  reportInputBodySchema,
  listReportsQuerySchema,
  listReportCommitsQuerySchema,
  reportIdParamsSchema,
  updateReportBodySchema,
  replyBodySchema,
} from "@/reports/schemas";
import {
  createReportUseCase,
  updateReportUseCase,
  replyToReportUseCase,
  NoCommitsError,
  ReportNotFoundError,
  AIGenerationError,
  ProviderKeyError,
} from "@/reports/use-cases";
import { SyncError } from "@/projects/sync-service";
import * as projectsStore from "@/projects/stores/projects-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import {
  encodeReportCommitsCursor,
  decodeReportCommitsCursor,
  type ReportCommitsCursor,
} from "@/reports/stores/report-commits-store";
import { formatDate } from "@/shared/utils";

export async function createReport(req: FastifyRequest, reply: FastifyReply) {
  const parsed = reportInputBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  try {
    const { reportId, projectId } = await createReportUseCase(parsed.data.data);
    return reply.code(201).send({ reportId, projectId });
  } catch (error: any) {
    console.error("Error generating report:", error);
    if (error instanceof NoCommitsError) {
      return reply.status(400).send({ error: error.message });
    }
    if (error instanceof ProviderKeyError) {
      return reply.status(400).send({ error: error.message });
    }
    if (error instanceof AIGenerationError) {
      return reply.status(error.status).send({ error: error.message });
    }
    if (error instanceof SyncError) {
      return reply.status(error.status).send({ error: error.message });
    }
    if (error?.status === 404 || error?.status === 422) {
      return reply.status(400).send({
        error: "Branch or repository not found on GitHub. Check the branch name and repository access.",
      });
    }
    return reply.status(500).send({ error: "Failed to generate report" });
  }
}

export async function listReports(
  req: FastifyRequest<{ Querystring: { projectId?: string } }>,
  reply: FastifyReply,
) {
  const query = listReportsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return reply.status(400).send({ error: query.error.flatten() });
  }

  try {
    const rows = await reportsStore.listReports({ projectId: query.data.projectId });
    const projectIds = [...new Set(rows.map((r) => r.projectId))];
    const projects = await projectsStore.getProjectsByIds({ ids: projectIds });
    const projectById = new Map(projects.map((p) => [p.id, p]));

    return reply.send({
      reports: rows.map((report) => {
        const project = projectById.get(report.projectId);
        return {
          id: report.id,
          projectId: report.projectId,
          title: report.title,
          repositoryName: project?.repositoryName ?? "",
          branch: report.branch,
          startDate: formatDate(report.startDate),
          endDate: formatDate(report.endDate),
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        };
      }),
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
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  try {
    const report = await reportsStore.getReport({ id: params.data.id });
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const project = await projectsStore.getProjectById({ id: report.projectId });

    return reply.send({
      id: report.id,
      projectId: report.projectId,
      title: report.title,
      repositoryName: project?.repositoryName ?? "",
      originalMarkdown: report.originalMarkdown,
      editableMarkdown: report.editableMarkdown,
      startDate: formatDate(report.startDate),
      endDate: formatDate(report.endDate),
      branch: report.branch,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return reply.status(500).send({ error: "Failed to fetch report" });
  }
}

export async function getReportCommits(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }
  const query = listReportCommitsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return reply.status(400).send({ error: query.error.flatten() });
  }

  let cursor: ReportCommitsCursor | undefined;
  if (query.data.cursor) {
    try {
      cursor = decodeReportCommitsCursor(query.data.cursor);
    } catch {
      return reply.status(400).send({ error: "Invalid cursor" });
    }
  }

  try {
    const report = await reportsStore.getReport({ id: params.data.id });
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const { rows, nextCursor } = await reportCommitsStore.listCommitsForReport({
      reportId: report.id,
      projectId: report.projectId,
      branch: report.branch,
      q: query.data.q,
      cursor,
      limit: query.data.limit,
    });

    const total = await reportCommitsStore.countCommitsForReport({
      reportId: report.id,
      projectId: report.projectId,
      branch: report.branch,
      q: query.data.q,
    });

    return reply.send({
      commits: rows.map((c) => ({
        id: c.id,
        commitSha: c.commitSha,
        commitMessage: c.commitMessage,
        author: c.author,
        diffSummary: c.diffSummary,
        committedAt: c.committedAt,
        metadata: c.metadata,
      })),
      nextCursor: nextCursor ? encodeReportCommitsCursor(nextCursor) : null,
      total,
    });
  } catch (error) {
    console.error("Error fetching report commits:", error);
    return reply.status(500).send({ error: "Failed to fetch report commits" });
  }
}

export async function updateReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  const body = updateReportBodySchema.safeParse(req.body);
  if (!body.success) {
    return reply.status(400).send({ error: body.error.flatten() });
  }

  try {
    const updated = await updateReportUseCase({
      reportId: params.data.id,
      editableMarkdown: body.data.editableMarkdown,
    });

    return reply.send({
      id: updated.id,
      editableMarkdown: updated.editableMarkdown,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    if (error instanceof ReportNotFoundError) {
      return reply.status(404).send({ error: error.message });
    }
    return reply.status(500).send({ error: "Failed to update report" });
  }
}

export async function replyToReport(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const params = reportIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    return reply.status(400).send({ error: params.error.flatten() });
  }

  const body = replyBodySchema.safeParse(req.body);
  if (!body.success) {
    return reply.status(400).send({ error: body.error.flatten() });
  }

  const { reply: userReply, model, provider } = body.data;

  if (!userReply || userReply.trim().length === 0) {
    return reply.status(400).send({ error: "reply is required" });
  }

  try {
    const report = await replyToReportUseCase({
      reportId: params.data.id,
      reply: userReply,
      model,
      provider,
    });

    return reply.send({ report });
  } catch (error: any) {
    console.error("Error replying to report:", error);
    if (error instanceof ReportNotFoundError) {
      return reply.status(404).send({ error: error.message });
    }
    if (error?.status === 429) {
      return reply.status(429).send({ error: "Rate limit reached. Please try again later." });
    }
    return reply.status(500).send({ error: "Failed to process reply" });
  }
}
