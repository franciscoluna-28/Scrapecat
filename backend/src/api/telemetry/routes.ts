import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { telemetryService } from "@/api/telemetry/service";
import { ListIngestionRunsRoute } from "@/api/telemetry/schemas";

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
  app.get(
    "/telemetry/ingestion-runs",
    { schema: ListIngestionRunsRoute },
    listIngestionRuns,
  );
};
