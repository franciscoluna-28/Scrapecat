import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import { AISettingsBody } from "@/api/settings/schemas";
import { getAISettings, updateAISettings } from "@/api/settings/services";
import { env } from "@/shared/config/env";

export async function getSettingsRoute(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const settings = await getAISettings();
    return reply.send(settings);
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    return reply.status(500).send({ error: "Failed to fetch AI settings" });
  }
}

export async function updateSettingsRoute(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoMode) {
    return reply
      .status(403)
      .send({ error: "AI settings are managed by the server in demo mode" });
  }

  const body = req.body as Static<typeof AISettingsBody>;

  try {
    const settings = await updateAISettings(body);
    return reply.send(settings);
  } catch (error: any) {
    if (error?.message?.startsWith("Unsupported")) {
      return reply.status(400).send({ error: error.message });
    }
    console.error("Error updating AI settings:", error);
    return reply.status(500).send({ error: "Failed to update AI settings" });
  }
}
