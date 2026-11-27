import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { Static } from "@sinclair/typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { demoModeGuard } from "@/shared/guards";
import {
  getAISettings,
  updateAISettings,
  type AISettings,
} from "@/api/settings/services";
import { listModels } from "@/api/settings/models";
import {
  AISettingsGetResponse,
  GetAISettingsRoute,
  ListModelsRoute,
  UpdateAISettingsRoute,
} from "@/api/settings/schemas";

type AISettingsDTO = Static<typeof AISettingsGetResponse>;

/**
 * The settings row is stored as text; narrowing to the response union keeps the
 * typed reply honest without pretending the database is constrained.
 */
function toSettingsDTO(settings: AISettings): AISettingsDTO {
  return {
    chatProvider: settings.chatProvider as AISettingsDTO["chatProvider"],
    chatModel: settings.chatModel,
    embeddingProvider:
      settings.embeddingProvider as AISettingsDTO["embeddingProvider"],
    embeddingModel: settings.embeddingModel,
  };
}

export async function getSettingsRoute(
  _req: TypeBoxRequest<typeof GetAISettingsRoute>,
  _reply: TypeBoxReply<typeof GetAISettingsRoute>,
) {
  return toSettingsDTO(await getAISettings());
}

export async function updateSettingsRoute(
  req: TypeBoxRequest<typeof UpdateAISettingsRoute>,
  _reply: TypeBoxReply<typeof UpdateAISettingsRoute>,
) {
  return toSettingsDTO(await updateAISettings(req.body));
}

export const settingsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get("/settings/ai", { schema: GetAISettingsRoute }, getSettingsRoute);

  app.put(
    "/settings/ai",
    {
      schema: UpdateAISettingsRoute,
      preHandler: demoModeGuard(
        "AI settings are managed by the server in demo mode",
      ),
    },
    updateSettingsRoute,
  );

  app.get("/models", { schema: ListModelsRoute }, listModels);
};
