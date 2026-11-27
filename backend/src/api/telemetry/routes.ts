import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { demoModeGuard } from "@/shared/guards";
import { telemetryService } from "@/api/telemetry/service";
import { ListIngestionRunsRoute } from "@/api/telemetry/schemas";

const DEMO_ERROR = "Ingestion telemetry is not available in demo mode";

export async function listIngestionRuns(
  req: TypeBoxRequest<typeof ListIngestionRunsRoute>,
  _reply: TypeBoxReply<typeof ListIngestionRunsRoute>,
) {
  const query = req.query;
  return telemetryService.listIngestionRuns({
    limit: query.limit ?? 8,
    windowDays: query.windowDays ?? 7,
    projectId: query.projectId,
    jobType: query.jobType,
  });
}

export const telemetryRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", demoModeGuard(DEMO_ERROR));

  app.get(
    "/telemetry/ingestion-runs",
    { schema: ListIngestionRunsRoute },
    listIngestionRuns,
  );
};
