import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import {
  GIT_PROVIDERS,
  getGitProvider,
  commitUrl,
  type GitProviderId,
  type Repository,
} from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import { restrictDemoBranches } from "@/shared/demo-branches";
import { listCommitsFromApi } from "@/repositories/github-api";
import { projectsStore } from "@/projects/stores/projects-store";
import { commitChunksStore } from "@/projects/stores/commit-chunks-store";
import type { Static } from "@sinclair/typebox";
import {
  RepoOwnerParams,
  BranchesQuery,
  CommitsQuery,
  CommitsCountQuery,
  RepositoriesQuery,
} from "@/gitRepositories/schemas";

type RepositoryWithProvider = Repository & { provider: GitProviderId };

type DiscoveryTarget = { provider: GitProviderId; token: string | null };

type DiscoveryFilters = {
  type: string;
  sort: string;
  direction: string;
  perPage: number;
};

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

/**
 * Demo ingestion reads the public GitHub REST API only (no git binary). GitLab
 * is a self-hosted-path provider for now, so reject it up front instead of
 * silently querying GitHub for a GitLab repository.
 */
function unsupportedInDemo(provider: string): string | null {
  if (env.isDemoMode && provider !== "github") {
    return "Demo mode only supports GitHub repositories";
  }
  return null;
}

/**
 * Discovery fans out to every provider the server can actually read from:
 * demo is GitHub-only, otherwise a provider counts when a stored/env token
 * exists. With no tokens at all, keep the anonymous public GitHub fallback.
 */
async function resolveDiscoveryTargets(): Promise<DiscoveryTarget[]> {
  if (env.isDemoMode) return [{ provider: "github", token: null }];

  const all = await Promise.all(
    GIT_PROVIDERS.map(async (provider) => {
      try {
        return { provider, token: await resolveGitToken(provider) };
      } catch (error) {
        // A broken credential for one host must not hide the other host.
        console.error(`Error resolving ${provider} token:`, error);
        return { provider, token: null };
      }
    }),
  );
  const connected = all.filter((target) => target.token);
  return connected.length > 0 ? connected : [{ provider: "github", token: null }];
}

async function fetchProviderRepositories(
  { provider, token }: DiscoveryTarget,
  filters: DiscoveryFilters,
): Promise<RepositoryWithProvider[]> {
  const client = getGitProvider(provider, token);
  // Anonymous/demo reads are public-only; never expose a token owner's repos.
  const repositories =
    token && !env.isDemoMode
      ? await client.listRepositories(filters)
      : await client.searchPublicRepositories("stars:>100", filters.perPage);

  return repositories.map((repository) => ({ ...repository, provider }));
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
  const filters: DiscoveryFilters = {
    type: type || "all",
    sort: sort || "updated",
    direction: direction || "desc",
    perPage: per_page || 10,
  };

  try {
    // Explicit provider keeps the single-host behavior (still provider-tagged).
    if (providerQuery) {
      const unsupported = unsupportedInDemo(providerQuery);
      if (unsupported) return reply.status(400).send({ error: unsupported });

      const token = await resolveGitToken(providerQuery);
      const repositories = await fetchProviderRepositories(
        { provider: providerQuery, token },
        filters,
      );
      return reply.send(repositories);
    }

    const targets = await resolveDiscoveryTargets();
    const settled = await Promise.allSettled(
      targets.map((target) => fetchProviderRepositories(target, filters)),
    );

    const repositories: RepositoryWithProvider[] = [];
    let failures = 0;

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        repositories.push(...result.value);
        return;
      }
      failures += 1;
      console.error(
        `Error fetching ${targets[index]?.provider} repositories:`,
        result.reason,
      );
    });

    // Only fail the request when every provider failed; otherwise show the
    // hosts that did respond.
    if (failures === settled.length) {
      return reply.status(500).send({ error: "Failed to fetch repositories" });
    }

    repositories.sort((a, b) =>
      filters.direction === "asc"
        ? (a.updated_at ?? "").localeCompare(b.updated_at ?? "")
        : (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );

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
  const { provider: providerQuery } = req.query as Static<typeof BranchesQuery>;
  // The client passes the project's provider, so discovery needs no DB read.
  const gitProvider = providerQuery ?? "github";

  const unsupported = unsupportedInDemo(gitProvider);
  if (unsupported) return reply.status(400).send({ error: unsupported });

  try {
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
  const {
    provider: providerQuery,
    limit,
    startDate,
    endDate,
    branch,
  } = req.query as Static<typeof CommitsQuery>;

  try {
    if (env.isDemoMode) {
      // Demo has no guaranteed project row; the client supplies the provider.
      const gitProvider = providerQuery ?? "github";
      // Demo reads use the GitHub REST API; fail fast for other providers.
      const unsupported = unsupportedInDemo(gitProvider);
      if (unsupported) return reply.status(400).send({ error: unsupported });
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

    const project = await projectsStore.getProjectByOwnerRepo({
      gitProvider: providerQuery ?? "github",
      providerOwner: owner,
      repositoryName: repo,
    });
    if (!project) return reply.send({ commits: [] });

    const gitProvider = project.gitProvider;
    const rows = await commitChunksStore.listCommitsForProject({
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
  const {
    provider: providerQuery,
    startDate,
    endDate,
    branch,
  } = req.query as Static<typeof CommitsCountQuery>;

  try {
    if (env.isDemoMode) {
      // Demo has no guaranteed project row; the client supplies the provider.
      const gitProvider = providerQuery ?? "github";
      const unsupported = unsupportedInDemo(gitProvider);
      if (unsupported) return reply.status(400).send({ error: unsupported });
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

    const project = await projectsStore.getProjectByOwnerRepo({
      gitProvider: providerQuery ?? "github",
      providerOwner: owner,
      repositoryName: repo,
    });
    if (!project) return reply.send({ count: 0 });

    const rows = await commitChunksStore.listCommitsForProject({
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
