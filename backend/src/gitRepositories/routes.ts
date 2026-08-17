import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import type { Static } from "@sinclair/typebox";
import {
  RepoOwnerParams,
  CommitsQuery,
  CommitsCountQuery,
  RepositoriesQuery,
} from "@/gitRepositories/schemas";

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { type, sort, direction, per_page } = req.query as Static<typeof RepositoriesQuery>;

  try {
    const repositories = await getGitProvider().listRepositories({
      type: type || "all",
      sort: sort || "updated",
      direction: direction || "desc",
      perPage: per_page,
    });
    return reply.send(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return reply.status(500).send({ error: "Failed to fetch repositories" });
  }
}

export async function listBranches(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;

  try {
    const branches = await getGitProvider().listBranches(owner, repo);
    return reply.send({ branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return reply.status(500).send({ error: "Failed to fetch branches" });
  }
}

export async function listCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { limit, startDate, endDate, branch } = req.query as Static<typeof CommitsQuery>;

  try {
    const page = await getGitProvider().listCommitsPage(owner, repo, {
      perPage: limit,
      page: 1,
      branch: branch || undefined,
      since: startDate || undefined,
      until: endDate || undefined,
    });
    return reply.send({ commits: page.items });
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
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { startDate, endDate } = req.query as Static<typeof CommitsCountQuery>;

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
