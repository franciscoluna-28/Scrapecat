import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { restrictDemoBranches } from "@/shared/demo-branches";
import { resolveGithubToken } from "@/github/token";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange } from "@/repositories/git-reader";
import { listCommitsFromApi } from "@/repositories/github-api";
import type { Static } from "@sinclair/typebox";
import {
  RepoOwnerParams,
  CommitsQuery,
  CommitsCountQuery,
  RepositoriesQuery,
} from "@/gitRepositories/schemas";

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { type, sort, direction, per_page } = req.query as Static<typeof RepositoriesQuery>;

  try {
    const token = await resolveGithubToken();
    // Demo mode is public-only: never call /user/repos, which would expose the
    // token owner's private repositories. Always use public search instead.
    if (token && !env.isDemoMode) {
      const repositories = await getGitProvider(token).listRepositories({
        type: type || "all",
        sort: sort || "updated",
        direction: direction || "desc",
        perPage: per_page,
      });
      return reply.send(repositories);
    }
    // No token — fall back to public repo search so demo works without API keys
    const provider = getGitProvider(null);
    const repositories = await provider.searchPublicRepositories("stars:>100", per_page || 10);
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
    const provider = getGitProvider(await resolveGithubToken());
    const [allBranches, defaultBranch] = await Promise.all([
      provider.listBranches(owner, repo),
      provider.getDefaultBranch(owner, repo),
    ]);
    // Demo: expose only trunk branches (or the default) to bound ingestion.
    const branches = env.isDemoMode
      ? restrictDemoBranches(allBranches, defaultBranch)
      : allBranches;
    return reply.send({ branches, defaultBranch });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return reply.status(500).send({ error: "Failed to fetch branches" });
  }
}

/**
 * Commit preview. Demo mode reads the GitHub REST API (no git binary); the
 * self-hosted path reads the local clone of the branch. Both are public-only
 * for public repos.
 */
export async function listCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { limit, startDate, endDate, branch } = req.query as Static<typeof CommitsQuery>;
  const ref = branch || (await getGitProvider(await resolveGithubToken()).getDefaultBranch(owner, repo));

  try {
    if (env.isDemoMode) {
      const commits = await listCommitsFromApi({
        owner,
        repo,
        branch: ref,
        since: parseDate(startDate),
        until: parseDate(endDate),
        max: limit,
      });
      return reply.send({
        commits: commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          date: c.date,
          url: c.url,
        })),
      });
    }

    const archive = await ensureArchive({ owner, repo, branch: ref });
    const commits = await listCommitsInRange({
      dir: archive.dir,
      ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
    });
    return reply.send({
      commits: commits.slice(0, limit).map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        date: c.date,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching commits:", error);
    if (error?.status === 404 || error?.status === 422 || error?.code === "NotFoundError") {
      return reply.status(400).send({
        error: "Branch or repository not found on GitHub. Check the branch name and repository access.",
      });
    }
    if (error?.code === "BranchNotFound") {
      return reply.status(400).send({
        error: `Branch "${ref}" not found in this repository. Check the branch name.`,
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
  const { startDate, endDate, branch } = req.query as Static<typeof CommitsCountQuery>;
  const ref = branch || (await getGitProvider(await resolveGithubToken()).getDefaultBranch(owner, repo));

  try {
    if (env.isDemoMode) {
      const commits = await listCommitsFromApi({
        owner,
        repo,
        branch: ref,
        since: parseDate(startDate),
        until: parseDate(endDate),
        max: 1000,
      });
      return reply.send({ count: commits.length });
    }

    const archive = await ensureArchive({ owner, repo, branch: ref });
    const commits = await listCommitsInRange({
      dir: archive.dir,
      ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
    });
    return reply.send({ count: commits.length });
  } catch (error: any) {
    console.error("Error fetching commit count:", error);
    if (error?.code === "BranchNotFound") {
      return reply.status(400).send({
        error: `Branch "${ref}" not found in this repository. Check the branch name.`,
      });
    }
    return reply.status(500).send({ error: "Failed to fetch commit count" });
  }
}
