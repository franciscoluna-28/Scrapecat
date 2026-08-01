import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "../services/git-provider";
import { ownerRepoParamsSchema, listCommitsQuerySchema, countCommitsQuerySchema } from "../schemas";

export async function listCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsParsed = ownerRepoParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return reply.status(400).send({ error: paramsParsed.error.flatten() });
  }
  const { owner, repo } = paramsParsed.data;

  const queryParsed = listCommitsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return reply.status(400).send({ error: queryParsed.error.flatten() });
  }
  const { limit, startDate, endDate, branch } = queryParsed.data;

  try {
    const commits = await getGitProvider().listCommits(owner, repo, {
      perPage: parseInt(limit || "100"),
      branch: branch || undefined,
      since: startDate || undefined,
      until: endDate || undefined,
    });
    return reply.send({ commits });
  } catch (error: any) {
    console.error("Error fetching commits:", error);
    if (error?.status === 404 || error?.status === 422) {
      return reply.status(400).send({
        error: "Branch or repository not found on GitHub. Check the branch name and repository access.",
      });
    }
    return reply.status(500).send({ error: "Failed to fetch commits" });
  }
}

export async function countCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsParsed = ownerRepoParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return reply.status(400).send({ error: paramsParsed.error.flatten() });
  }
  const { owner, repo } = paramsParsed.data;

  const queryParsed = countCommitsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return reply.status(400).send({ error: queryParsed.error.flatten() });
  }
  const { startDate, endDate } = queryParsed.data;

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
