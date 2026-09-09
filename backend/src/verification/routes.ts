import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGithubToken } from "@/github/token";

export async function checkVerification(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const token = await resolveGithubToken();
    if (!token) {
      return reply.send({ status: "error", message: "GitHub token is not configured" });
    }

    const { login, rateLimitRemaining } = await getGitProvider(token).verifyConnection();

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
