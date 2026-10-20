import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import {
  getGitProvider,
  commitUrl,
  type GitProviderId,
} from "@/shared/integrations/git-provider";
import { getGitProviderConfig } from "@/shared/integrations/git-provider/registry";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import { restrictDemoBranches } from "@/shared/demo-branches";
import { listCommitsFromApi } from "@/repositories/github-api";
import * as projectsStore from "@/projects/stores/projects-store";
import { listCommitsForProject } from "@/projects/stores/commit-chunks-store";
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

/**
 * Resolves a repository's provider from its project row. The provider is a
 * property of the project, never a global env setting. Unregistered repos fall
 * back to GitHub (the only implemented provider) so discovery still works
 * before a project is created.
 */
async function resolveRepoProvider(owner: string, repo: string) {
  const project = await projectsStore.getProjectByOwnerRepo({
    providerOwner: owner,
    repositoryName: repo,
  });
  const gitProvider: GitProviderId = project?.gitProvider ?? "github";
  return { project, gitProvider };
}

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const {
    provider: providerQuery,
    type,
    sort,
    direction,
    per_page,
  } = req.query as Static<typeof RepositoriesQuery>;
  const provider = providerQuery ?? "github";

  try {
    const token = await resolveGitToken(provider);
    // Demo mode is public-only: never call /user/repos, which would expose the
    // token owner's private repositories. Always use public search instead.
    if (token && !env.isDemoMode) {
      const repositories = await getGitProvider(provider, token).listRepositories({
        type: type || "all",
        sort: sort || "updated",
        direction: direction || "desc",
        perPage: per_page,
      });
      return reply.send(repositories);
    }
    // No token — fall back to public repo search so demo works without API keys
    const providerClient = getGitProvider(provider, null);
    const repositories = await providerClient.searchPublicRepositories("stars:>100", per_page || 10);
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
    const { gitProvider } = await resolveRepoProvider(owner, repo);
    const provider = getGitProvider(gitProvider, await resolveGitToken(gitProvider));
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
 * self-hosted path is now served from Postgres (`commit_chunks`, the read
 * model) — the API never touches git or local disk. Unknown repos simply have
 * no ingested commits yet.
 */
export async function listCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { limit, startDate, endDate, branch } = req.query as Static<typeof CommitsQuery>;

  try {
    const { project, gitProvider } = await resolveRepoProvider(owner, repo);

    if (env.isDemoMode) {
      // Demo reads use the GitHub REST API; fail fast for other providers.
      getGitProviderConfig(gitProvider);
      const ref =
        branch ||
        (await getGitProvider(gitProvider, await resolveGitToken(gitProvider)).getDefaultBranch(
          owner,
          repo,
        ));
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

    if (!project) return reply.send({ commits: [] });

    const rows = await listCommitsForProject({
      projectId: project.id,
      branch: branch || project.defaultBranch,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
    });
    return reply.send({
      commits: rows.slice(0, limit).map((c) => ({
        sha: c.commitSha,
        message: c.commitMessage,
        author: c.author ?? "",
        date: c.committedAt.toISOString(),
        url: c.metadata?.commitUrl ?? commitUrl(gitProvider, owner, repo, c.commitSha),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching commits:", error);
    return reply.status(500).send({ error: "Failed to fetch commits" });
  }
}

export async function countCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { startDate, endDate, branch } = req.query as Static<typeof CommitsCountQuery>;

  try {
    const { project, gitProvider } = await resolveRepoProvider(owner, repo);

    if (env.isDemoMode) {
      getGitProviderConfig(gitProvider);
      const ref =
        branch ||
        (await getGitProvider(gitProvider, await resolveGitToken(gitProvider)).getDefaultBranch(
          owner,
          repo,
        ));
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

    if (!project) return reply.send({ count: 0 });

    const rows = await listCommitsForProject({
      projectId: project.id,
      branch: branch || project.defaultBranch,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
    });
    return reply.send({ count: rows.length });
  } catch (error: any) {
    console.error("Error fetching commit count:", error);
    return reply.status(500).send({ error: "Failed to fetch commit count" });
  }
}
