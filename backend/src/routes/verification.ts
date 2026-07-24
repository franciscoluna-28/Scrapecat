import { FastifyRequest, FastifyReply } from "fastify";
import { octokit } from "../services/github";
import { env } from "../config/env";

export async function checkVerification(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    if (!env.GITHUB_TOKEN) {
      return reply.send({ status: "error", message: "GITHUB_TOKEN is not configured" });
    }

    const { data: user } = await octokit.request("GET /user", {
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });

    return reply.send({
      status: "ok",
      github: {
        login: user.login,
        rateLimitRemaining: 5000,
      },
    });
  } catch (error: any) {
    return reply.send({
      status: "error",
      message: error.message || "GitHub connection failed",
    });
  }
}
