import { FastifyRequest, FastifyReply } from "fastify";
import { aiSettingsInputSchema } from "@/settings/schemas";
import { getAISettings, updateAISettings } from "@/settings/services";

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
  const parsed = aiSettingsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  try {
    const settings = await updateAISettings(parsed.data);
    return reply.send(settings);
  } catch (error: any) {
    if (error?.message?.startsWith("Unsupported provider")) {
      return reply.status(400).send({ error: error.message });
    }
    console.error("Error updating AI settings:", error);
    return reply.status(500).send({ error: "Failed to update AI settings" });
  }
}
