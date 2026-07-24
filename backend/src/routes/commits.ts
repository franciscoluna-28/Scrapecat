import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "../services/git-provider";

export async function listCommits(
  req: FastifyRequest<{ Params: { owner: string; repo: string }; Querystring: { limit?: string; startDate?: string; endDate?: string; branch?: string } }>,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params;
  const { limit, startDate, endDate, branch } = req.query;

  try {
    const commits = await getGitProvider().listCommits(owner, repo, {
      perPage: parseInt(limit || "100"),
      branch: branch || undefined,
      since: startDate || undefined,
      until: endDate || undefined,
    });
    return reply.send({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return reply.status(500).send({ error: "Failed to fetch commits" });
  }
}

export async function countCommits(
  req: FastifyRequest<{ Params: { owner: string; repo: string }; Querystring: { startDate?: string; endDate?: string } }>,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const count = await getGitProvider().countCommits(owner, repo, {
      since: startDate || undefined,
      until: endDate || undefined,
    });
    return reply.send({ count });
  } catch (error) {
    console.error("Error fetching commit count:", error);
    return reply.status(500).send({ error: "Failed to fetch commit count" });
  }
}
