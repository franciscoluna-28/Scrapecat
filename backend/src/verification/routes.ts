import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
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

    // Demo mode never probes `GET /user` — that would expose the token owner's
    // login. A configured token is enough to report the connection as usable.
    if (env.isDemoMode) {
      return reply.send({ status: "ok" });
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
