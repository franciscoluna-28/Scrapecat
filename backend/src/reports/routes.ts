import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import {
  ReportInputBody,
  ReportsListQuery,
  ReportIdParams,
  ReportCommitsQuery,
  ReportJobParams,
} from "@/reports/schemas";
import {
  enqueueReportJob,
  getReportJob,
  jobEvents,
} from "@/reports/jobs";
import type { ReportJobRow } from "@/reports/stores/job-store";
import { ProviderKeyError } from "@/reports/use-cases";
import * as projectsStore from "@/projects/stores/projects-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import {
  encodeReportCommitsCursor,
  decodeReportCommitsCursor,
  type ReportCommitsCursor,
} from "@/reports/stores/report-commits-store";
import { formatDate, startOfDayUtc, endOfDayUtc } from "@/shared/utils";
import { applyCorsToRawResponse } from "@/shared/cors-raw";

export function toJobResponse(job: ReportJobRow) {
  return {
    jobId: job.id,
    status: job.status,
    phase: job.phase,
    commitCount: job.commitCount,
    progress: job.progress,
    reportId: job.reportId,
    projectId: job.projectId,
    error: job.error,
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  };
}

export async function createReport(req: FastifyRequest, reply: FastifyReply) {
  const { data } = req.body as Static<typeof ReportInputBody>;

  try {
    const job = await enqueueReportJob(data);
    return reply
      .code(202)
      .send({ jobId: job.id, status: job.status });
  } catch (error) {
    if (error instanceof ProviderKeyError) {
      return reply.status(400).send({ error: error.message });
    }
    console.error("Error queueing report:", error);
    return reply.status(500).send({ error: "Failed to queue report" });
  }
}

export async function getReportJobStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { jobId } = req.params as Static<typeof ReportJobParams>;

  const job = await getReportJob(jobId);
  if (!job) {
    return reply.status(404).send({ error: "Report job not found" });
  }
  return reply.send(toJobResponse(job));
}

/**
 * SSE stream for a job. Sends the current persisted state on connect, then
 * pushes every transition emitted by the job runner. Closes on a terminal
 * state or when the client disconnects.
 *
 * The listener is attached *before* the post-subscribe re-check so a terminal
 * transition that races the initial fetch is still observed — otherwise the
 * stream would idle forever after the job finished.
 */
export async function streamReportJob(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { jobId } = req.params as Static<typeof ReportJobParams>;

  const job = await getReportJob(jobId);
  if (!job) {
    return reply.status(404).send({ error: "Report job not found" });
  }

  reply.hijack();
  const res = reply.raw;
  applyCorsToRawResponse(req.raw, res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    jobEvents.removeListener(jobId, listener);
    res.end();
  };

  const sendState = (state: ReportJobRow) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(toJobResponse(state))}\n\n`);
    } catch {
      close();
      return;
    }
    if (state.status === "succeeded" || state.status === "failed") {
      close();
    }
  };

  const listener = (state: ReportJobRow) => sendState(state);
  jobEvents.on(jobId, listener);

  sendState(job);

  // Re-check now that we're subscribed: if the job finished between the fetch
  // above and this point, the emit was already missed — resend the terminal
  // state so the client always observes it.
  const current = await getReportJob(jobId);
  if (current) sendState(current);

  req.raw.on("close", close);
}

export async function getJobCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { jobId } = req.params as Static<typeof ReportJobParams>;
  const { q, cursor, limit } = req.query as Static<typeof ReportCommitsQuery>;

  let cursorValue: ReportCommitsCursor | undefined;
  if (cursor) {
    try {
      cursorValue = decodeReportCommitsCursor(cursor);
    } catch {
      return reply.status(400).send({ error: "Invalid cursor" });
    }
  }

  const job = await getReportJob(jobId);
  if (!job) {
    return reply.status(404).send({ error: "Report job not found" });
  }
  if (!job.projectId) {
    return reply.send({ commits: [], nextCursor: null, total: 0 });
  }

  const branch = job.data.branch;
  const startDate = startOfDayUtc(job.data.startDate);
  const endDate = endOfDayUtc(job.data.endDate);

  try {
    const { rows, nextCursor } = await reportCommitsStore.listCommitsForWindow({
      projectId: job.projectId,
      branch,
      startDate,
      endDate,
      q,
      cursor: cursorValue,
      limit,
    });

    const total = await reportCommitsStore.countCommitsForWindow({
      projectId: job.projectId,
      branch,
      startDate,
      endDate,
      q,
    });

    return reply.send({
      commits: rows.map((c) => ({
        id: c.id,
        commitSha: c.commitSha,
        commitMessage: c.commitMessage,
        author: c.author,
        committedAt: c.committedAt,
        metadata: c.metadata,
      })),
      nextCursor: nextCursor ? encodeReportCommitsCursor(nextCursor) : null,
      total,
    });
  } catch (error) {
    console.error("Error fetching job commits:", error);
    return reply.status(500).send({ error: "Failed to fetch job commits" });
  }
}

export async function listReports(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { projectId } = req.query as Static<typeof ReportsListQuery>;

  try {
    const rows = await reportsStore.listReports({ projectId });
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = req.params as Static<typeof ReportIdParams>;

  try {
    const report = await reportsStore.getReport({ id });
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = req.params as Static<typeof ReportIdParams>;
  const { q, cursor, limit } = req.query as Static<typeof ReportCommitsQuery>;

  let cursorValue: ReportCommitsCursor | undefined;
  if (cursor) {
    try {
      cursorValue = decodeReportCommitsCursor(cursor);
    } catch {
      return reply.status(400).send({ error: "Invalid cursor" });
    }
  }

  try {
    const report = await reportsStore.getReport({ id });
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }

    const { rows, nextCursor } = await reportCommitsStore.listCommitsForReport({
      reportId: report.id,
      projectId: report.projectId,
      branch: report.branch,
      q,
      cursor: cursorValue,
      limit,
    });

    const total = await reportCommitsStore.countCommitsForReport({
      reportId: report.id,
      projectId: report.projectId,
      branch: report.branch,
      q,
    });

    return reply.send({
      commits: rows.map((c) => ({
        id: c.id,
        commitSha: c.commitSha,
        commitMessage: c.commitMessage,
        author: c.author,
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
