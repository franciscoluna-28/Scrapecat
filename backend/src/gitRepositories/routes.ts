import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import {
  ownerRepoParamsSchema,
  listCommitsQuerySchema,
  countCommitsQuerySchema,
  listReposQuerySchema,
  branchQuerySchema,
} from "@/gitRepositories/schemas";

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = listReposQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }
  const { type, sort, direction, per_page } = parsed.data;

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
  const parsed = ownerRepoParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }
  const { owner, repo } = parsed.data;

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

export async function downloadRepositoryArchive(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsParsed = ownerRepoParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return reply.status(400).send({ error: paramsParsed.error.flatten() });
  }
  const { owner, repo } = paramsParsed.data;

  const queryParsed = branchQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return reply.status(400).send({ error: queryParsed.error.flatten() });
  }
  const { branch } = queryParsed.data;

  try {
    const archive = await getGitProvider().downloadRepositoryArchive(owner, repo, branch);
    return reply
      .type("application/zip")
      .header("Content-Disposition", `attachment; filename="${archive.filename}"`)
      .send(archive.stream);
  } catch (error: any) {
    console.error("Error downloading repository archive:", error);
    if (error?.status === 404) {
      return reply.status(404).send({ error: "Repository or branch not found" });
    }
    if (error?.status === 409) {
      return reply.status(400).send({ error: "Repository has no commits in that branch" });
    }
    return reply.status(500).send({ error: "Failed to download repository archive" });
  }
}
