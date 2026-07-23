import { FastifyRequest, FastifyReply } from "fastify";
import { getRepositoryCommits, getRepositoryCommitCount } from "../shared/github";

export async function listCommits(
  req: FastifyRequest<{ Querystring: { owner?: string; repo?: string; limit?: string; startDate?: string; endDate?: string; branch?: string } }>,
  reply: FastifyReply,
) {
  const { owner, repo, limit, startDate, endDate, branch } = req.query;

  if (!owner || !repo) {
    return reply.status(400).send({ error: "Missing required parameters: owner and repo" });
  }

  try {
    const commits = await getRepositoryCommits({
      owner,
      repo,
      per_page: parseInt(limit || "100"),
      sha: branch || undefined,
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
  req: FastifyRequest<{ Querystring: { owner?: string; repo?: string; startDate?: string; endDate?: string } }>,
  reply: FastifyReply,
) {
  const { owner, repo, startDate, endDate } = req.query;

  if (!owner || !repo) {
    return reply.status(400).send({ error: "Missing required parameters: owner and repo" });
  }

  try {
    const count = await getRepositoryCommitCount({
      owner,
      repo,
      since: startDate || undefined,
      until: endDate || undefined,
    });
    return reply.send({ count });
  } catch (error) {
    console.error("Error fetching commit count:", error);
    return reply.status(500).send({ error: "Failed to fetch commit count" });
  }
}
