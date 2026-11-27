import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { env } from "@/shared/config/env";
import { demoModeGuard } from "@/shared/guards";
import { reportsService } from "@/api/reports/service";
import {
  CreateReportScheduleRoute,
  DeleteReportScheduleRoute,
  GetReportRoute,
  ListReportSchedulesRoute,
  ListReportsRoute,
  RunReportScheduleRoute,
  UpdateReportScheduleRoute,
} from "@/api/reports/schemas";

const DEMO_ERROR = "Scheduled summaries are disabled in demo mode";

const REPORT_RATE_LIMIT = {
  max: env.REPORT_RATE_LIMIT_MAX,
  timeWindow: "1 minute",
} as const;

export async function listReportSchedules(
  _req: TypeBoxRequest<typeof ListReportSchedulesRoute>,
  _reply: TypeBoxReply<typeof ListReportSchedulesRoute>,
) {
  return { schedules: await reportsService.listSchedules() };
}

export async function createReportSchedule(
  req: TypeBoxRequest<typeof CreateReportScheduleRoute>,
  reply: TypeBoxReply<typeof CreateReportScheduleRoute>,
) {
  const schedule = await reportsService.createSchedule(req.body);
  reply.code(201);
  return schedule;
}

export async function updateReportSchedule(
  req: TypeBoxRequest<typeof UpdateReportScheduleRoute>,
  _reply: TypeBoxReply<typeof UpdateReportScheduleRoute>,
) {
  return reportsService.updateSchedule(req.params.id, req.body);
}

export async function deleteReportSchedule(
  req: TypeBoxRequest<typeof DeleteReportScheduleRoute>,
  reply: TypeBoxReply<typeof DeleteReportScheduleRoute>,
) {
  await reportsService.deleteSchedule(req.params.id);
  reply.code(204);
  return;
}

export async function runReportSchedule(
  req: TypeBoxRequest<typeof RunReportScheduleRoute>,
  reply: TypeBoxReply<typeof RunReportScheduleRoute>,
) {
  const result = await reportsService.startScheduleRun(req.params.id);
  reply.code(202);
  return result;
}

export async function listReports(
  req: TypeBoxRequest<typeof ListReportsRoute>,
  _reply: TypeBoxReply<typeof ListReportsRoute>,
) {
  const query = req.query;
  return {
    reports: await reportsService.listReports({
      projectId: query.projectId,
      branch: query.branch,
      limit: query.limit ?? 20,
    }),
  };
}

export async function getReport(
  req: TypeBoxRequest<typeof GetReportRoute>,
  _reply: TypeBoxReply<typeof GetReportRoute>,
) {
  return reportsService.getReport(req.params.id);
}

export const reportRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", demoModeGuard(DEMO_ERROR));

  app.get(
    "/report-schedules",
    { schema: ListReportSchedulesRoute },
    listReportSchedules,
  );

  app.post(
    "/report-schedules",
    { schema: CreateReportScheduleRoute, config: { rateLimit: REPORT_RATE_LIMIT } },
    createReportSchedule,
  );

  app.patch(
    "/report-schedules/:id",
    { schema: UpdateReportScheduleRoute },
    updateReportSchedule,
  );

  app.delete(
    "/report-schedules/:id",
    { schema: DeleteReportScheduleRoute },
    deleteReportSchedule,
  );

  app.post(
    "/report-schedules/:id/run",
    { schema: RunReportScheduleRoute, config: { rateLimit: REPORT_RATE_LIMIT } },
    runReportSchedule,
  );

  app.get("/reports", { schema: ListReportsRoute }, listReports);

  app.get("/reports/:id", { schema: GetReportRoute }, getReport);
};
