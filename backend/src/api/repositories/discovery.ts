import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { env } from "@/shared/config/env";
import { httpErrors } from "@/shared/errors";
import { demoProviderGuard } from "@/shared/guards";
import { logger } from "@/shared/logger";
import {
  GIT_PROVIDERS,
  getGitProvider,
  commitUrl,
  type GitProviderId,
  type Repository,
} from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import {
  restrictDemoBranches,
  isDemoTrunkBranch,
  isDemoBranchAllowed,
} from "@/shared/demo-branches";
import { githubApiClient } from "@/rag/github/github-api";
import { projectsStore } from "@/api/repositories/stores/projects-store";
import { commitEmbeddingsStore } from "@/rag/indexing/commit-embeddings-store";
import {
  CountCommitsRoute,
  ListBranchesRoute,
  ListCommitsRoute,
  ListRepositoriesRoute,
} from "@/api/repositories/schemas";

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

/** Demo may read only trunk branches or the provider's real default. */
async function demoBranchAllowed(
  gitProvider: GitProviderId,
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  if (isDemoTrunkBranch(branch)) return true;
  try {
    const actual = await getGitProvider(
      gitProvider,
      await resolveGitToken(gitProvider),
    ).getDefaultBranch(owner, repo);
    return isDemoBranchAllowed(branch, actual);
  } catch {
    return false;
  }
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
        logger.error(
          { err: error, provider },
          "failed to resolve git provider token",
        );
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
  req: TypeBoxRequest<typeof ListRepositoriesRoute>,
  _reply: TypeBoxReply<typeof ListRepositoriesRoute>,
) {
  const {
    provider: providerQuery,
    type,
    sort,
    direction,
    per_page,
  } = req.query;
  const filters: DiscoveryFilters = {
    type: type || "all",
    sort: sort || "updated",
    direction: direction || "desc",
    perPage: per_page || 10,
  };

  // Explicit provider keeps the single-host behavior (still provider-tagged).
  if (providerQuery) {
    const token = await resolveGitToken(providerQuery);
    return fetchProviderRepositories(
      { provider: providerQuery, token },
      filters,
    );
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
    req.log.error(
      { err: result.reason, provider: targets[index]?.provider },
      "failed to fetch repositories from provider",
    );
  });

  // Only fail the request when every provider failed; otherwise show the
  // hosts that did respond.
  if (failures === settled.length) {
    throw httpErrors.internalServerError("Failed to fetch repositories");
  }

  repositories.sort((a, b) =>
    filters.direction === "asc"
      ? (a.updated_at ?? "").localeCompare(b.updated_at ?? "")
      : (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );

  return repositories;
}

export async function listBranches(
  req: TypeBoxRequest<typeof ListBranchesRoute>,
  _reply: TypeBoxReply<typeof ListBranchesRoute>,
) {
  const { owner, repo } = req.params;
  const { provider: providerQuery } = req.query;
  // The client passes the project's provider, so discovery needs no DB read.
  const gitProvider = providerQuery ?? "github";

  const provider = getGitProvider(
    gitProvider,
    await resolveGitToken(gitProvider),
  );
  const [allBranches, defaultBranch] = await Promise.all([
    provider.listBranches(owner, repo),
    provider.getDefaultBranch(owner, repo),
  ]);
  // Demo: expose only trunk branches (or the default) to bound ingestion.
  const branches = env.isDemoMode
    ? restrictDemoBranches(allBranches, defaultBranch)
    : allBranches;
  return { branches, defaultBranch };
}

/**
 * Commit preview. Demo mode reads the GitHub REST API (no git binary); the
 * self-hosted path is now served from Postgres (`commit_embeddings`, the read
 * model) — the API never touches git or local disk. Unknown repos simply have
 * no ingested commits yet.
 */
export async function listCommits(
  req: TypeBoxRequest<typeof ListCommitsRoute>,
  _reply: TypeBoxReply<typeof ListCommitsRoute>,
) {
  const { owner, repo } = req.params;
  const { provider: providerQuery, limit, startDate, endDate, branch } =
    req.query;

  if (env.isDemoMode) {
    // Demo has no guaranteed project row; the client supplies the provider.
    const gitProvider = providerQuery ?? "github";
    const ref =
      branch ||
      (await getGitProvider(
        gitProvider,
        await resolveGitToken(gitProvider),
      ).getDefaultBranch(owner, repo));
    if (!(await demoBranchAllowed(gitProvider, owner, repo, ref))) {
      return { commits: [] };
    }
    const commits = await githubApiClient.listCommits({
      owner,
      repo,
      branch: ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
      max: limit,
    });
    return {
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        date: c.date,
        url: c.url,
      })),
    };
  }

  const project = await projectsStore.getProjectByOwnerRepo({
    gitProvider: providerQuery ?? "github",
    providerOwner: owner,
    repositoryName: repo,
  });
  if (!project) return { commits: [] };

  const gitProvider = project.gitProvider;
  const rows = await commitEmbeddingsStore.listCommitsForProject({
    repoId: project.id,
    branch: branch || project.defaultBranch,
    startDate: parseDate(startDate),
    endDate: parseDate(endDate),
  });
  return {
    commits: rows.slice(0, limit).map((c) => ({
      sha: c.commitSha,
      message: c.message,
      author: c.author ?? "",
      date: c.committedAt.toISOString(),
      url: c.commitUrl || commitUrl(gitProvider, owner, repo, c.commitSha),
    })),
  };
}

export async function countCommits(
  req: TypeBoxRequest<typeof CountCommitsRoute>,
  _reply: TypeBoxReply<typeof CountCommitsRoute>,
) {
  const { owner, repo } = req.params;
  const { provider: providerQuery, startDate, endDate, branch } = req.query;

  if (env.isDemoMode) {
    // Demo has no guaranteed project row; the client supplies the provider.
    const gitProvider = providerQuery ?? "github";
    const ref =
      branch ||
      (await getGitProvider(
        gitProvider,
        await resolveGitToken(gitProvider),
      ).getDefaultBranch(owner, repo));
    if (!(await demoBranchAllowed(gitProvider, owner, repo, ref))) {
      return { count: 0 };
    }
    const commits = await githubApiClient.listCommits({
      owner,
      repo,
      branch: ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
      max: 1000,
    });
    return { count: commits.length };
  }

  const project = await projectsStore.getProjectByOwnerRepo({
    gitProvider: providerQuery ?? "github",
    providerOwner: owner,
    repositoryName: repo,
  });
  if (!project) return { count: 0 };

  const rows = await commitEmbeddingsStore.listCommitsForProject({
    repoId: project.id,
    branch: branch || project.defaultBranch,
    startDate: parseDate(startDate),
    endDate: parseDate(endDate),
  });
  return { count: rows.length };
}

export const discoveryRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", demoProviderGuard);

  app.get(
    "/repositories",
    { schema: ListRepositoriesRoute },
    listRepositories,
  );
  app.get(
    "/repositories/:owner/:repo/branches",
    { schema: ListBranchesRoute },
    listBranches,
  );
  app.get(
    "/repositories/:owner/:repo/commits",
    { schema: ListCommitsRoute },
    listCommits,
  );
  app.get(
    "/repositories/:owner/:repo/commits/count",
    { schema: CountCommitsRoute },
    countCommits,
  );
};
