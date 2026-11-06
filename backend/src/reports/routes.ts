import type { FastifyReply, FastifyRequest } from "fastify";
import type { Static } from "@sinclair/typebox";
import { env } from "@/config/env";
import {
  REPORT_ERROR_MESSAGES,
  reportsService,
} from "@/reports/service";
import {
  CreateReportScheduleBody,
  ReportIdParams,
  ReportScheduleIdParams,
  ReportsQuery,
  UpdateReportScheduleBody,
} from "@/reports/schemas";

const DEMO_ERROR = "Scheduled summaries are disabled in demo mode";

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (
    message === REPORT_ERROR_MESSAGES.projectNotFound ||
    message === REPORT_ERROR_MESSAGES.scheduleNotFound ||
    message === REPORT_ERROR_MESSAGES.reportNotFound
  ) {
    return 404;
  }
  if (
    message === REPORT_ERROR_MESSAGES.branchNotFound ||
    message === REPORT_ERROR_MESSAGES.branchUnavailable ||
    message === REPORT_ERROR_MESSAGES.invalidTimezone
  ) {
    return 400;
  }
  if (
    message === REPORT_ERROR_MESSAGES.duplicateSchedule ||
    message === REPORT_ERROR_MESSAGES.scheduleRunning
  ) {
    return 409;
  }
  return 500;
}

function sendError(reply: FastifyReply, error: unknown) {
  const status = errorStatus(error);
  if (status === 500) {
    console.error("Report schedule error:", error);
    return reply.status(500).send({ error: "Report schedule request failed" });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return reply.status(status).send({ error: message });
}

export async function listReportSchedules(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  try {
    return reply.send({ schedules: await reportsService.listSchedules() });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function createReportSchedule(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const body = req.body as Static<typeof CreateReportScheduleBody>;
  try {
    return reply.code(201).send(await reportsService.createSchedule(body));
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function updateReportSchedule(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const { id } = req.params as Static<typeof ReportScheduleIdParams>;
  const body = req.body as Static<typeof UpdateReportScheduleBody>;
  try {
    return reply.send(await reportsService.updateSchedule(id, body));
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function deleteReportSchedule(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const { id } = req.params as Static<typeof ReportScheduleIdParams>;
  try {
    await reportsService.deleteSchedule(id);
    return reply.code(204).send();
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function runReportSchedule(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const { id } = req.params as Static<typeof ReportScheduleIdParams>;
  try {
    return reply.code(202).send(await reportsService.startScheduleRun(id));
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function listReports(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const query = req.query as Static<typeof ReportsQuery>;
  try {
    return reply.send({
      reports: await reportsService.listReports({
        projectId: query.projectId,
        branch: query.branch,
        limit: query.limit ?? 20,
      }),
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getReport(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply.status(403).send({ error: DEMO_ERROR });
  }
  const { id } = req.params as Static<typeof ReportIdParams>;
  try {
    return reply.send(await reportsService.getReport(id));
  } catch (error) {
    return sendError(reply, error);
  }
}
