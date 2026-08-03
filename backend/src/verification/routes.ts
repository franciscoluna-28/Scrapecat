import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { env } from "@/config/env";

export async function checkVerification(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    if (!env.GITHUB_TOKEN) {
      return reply.send({ status: "error", message: "GITHUB_TOKEN is not configured" });
    }

    const { login, rateLimitRemaining } = await getGitProvider().verifyConnection();

    return reply.send({
      status: "ok",
      github: {
        login,
        rateLimitRemaining,
      },
    });
  } catch (error: any) {
    return reply.send({
      status: "error",
      message: error.message || "GitHub connection failed",
    });
  }
}
