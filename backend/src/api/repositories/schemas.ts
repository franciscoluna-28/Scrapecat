import { Type } from "@sinclair/typebox";
import {
  GitProviderSchema,
  OptionalGitProviderSchema,
} from "@/shared/typebox";
import {
  BRANCH_PATTERN,
  OWNER_PATTERN,
  PROVIDER_PROJECT_ID_PATTERN,
  REPO_PATTERN,
} from "@/shared/utils";

export const ProjectsResponse = Type.Object({
  projects: Type.Array(
    Type.Object({
      id: Type.String(),
      gitProvider: GitProviderSchema,
      providerProjectId: Type.String(),
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      indexedBranches: Type.Array(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
      updatedAt: Type.String({ format: "date-time" }),
    }),
  ),
});

export const ProjectIdParams = Type.Object({
  id: Type.String(),
});

export const PrepareBranchBody = Type.Object({
  branch: Type.String({ minLength: 1, maxLength: 200, pattern: BRANCH_PATTERN }),
});

export const PrepareBranchResponse = Type.Object({
  branch: Type.String(),
  commitsFound: Type.Integer(),
  chunksWritten: Type.Integer(),
});

export const CreateProjectBody = Type.Object({
  gitProvider: OptionalGitProviderSchema,
  providerProjectId: Type.String({
    minLength: 1,
    maxLength: 200,
    pattern: PROVIDER_PROJECT_ID_PATTERN,
  }),
  providerOwner: Type.String({ minLength: 1, maxLength: 200, pattern: OWNER_PATTERN }),
  repositoryName: Type.String({ minLength: 1, maxLength: 100, pattern: REPO_PATTERN }),
  defaultBranch: Type.Optional(
    Type.String({ maxLength: 200, pattern: BRANCH_PATTERN, default: "main" }),
  ),
});

export const CreateProjectResponse = Type.Object({
  id: Type.String(),
  gitProvider: GitProviderSchema,
  providerProjectId: Type.String(),
  providerOwner: Type.String(),
  repositoryName: Type.String(),
  defaultBranch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const RepoOwnerParams = Type.Object({
  owner: Type.String({ minLength: 1, maxLength: 200, pattern: OWNER_PATTERN }),
  repo: Type.String({ minLength: 1, maxLength: 100, pattern: REPO_PATTERN }),
});

export const BranchesQuery = Type.Object({
  provider: OptionalGitProviderSchema,
});

export const CommitsQuery = Type.Object({
  provider: OptionalGitProviderSchema,
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 100 })),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  branch: Type.Optional(Type.String({ maxLength: 200, pattern: BRANCH_PATTERN })),
});

export const CommitsResponse = Type.Object({
  commits: Type.Array(
    Type.Object({
      sha: Type.String(),
      message: Type.String(),
      author: Type.String(),
      date: Type.String(),
      url: Type.Optional(Type.String()),
    }),
  ),
});

export const CommitsCountQuery = Type.Object({
  provider: OptionalGitProviderSchema,
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  branch: Type.Optional(Type.String({ maxLength: 200, pattern: BRANCH_PATTERN })),
});

export const CommitsCountResponse = Type.Object({
  count: Type.Integer(),
});

export const RepositoriesQuery = Type.Object({
  // No default: omitting `provider` means "every connected provider".
  provider: Type.Optional(GitProviderSchema),
  type: Type.Optional(Type.String({ default: "all" })),
  sort: Type.Optional(Type.String({ default: "updated" })),
  direction: Type.Optional(Type.String({ default: "desc" })),
  per_page: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
});

export const RepositoryResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  full_name: Type.String(),
  owner: Type.Object({ login: Type.String() }),
  private: Type.Boolean(),
  description: Type.Union([Type.String(), Type.Null()]),
  default_branch: Type.Optional(Type.String()),
  updated_at: Type.String(),
  stargazers_count: Type.Optional(Type.Number()),
  forks_count: Type.Optional(Type.Number()),
  provider: GitProviderSchema,
});

export const RepositoriesResponse = Type.Array(RepositoryResponse);

export const BranchesResponse = Type.Object({
  branches: Type.Array(Type.String()),
  defaultBranch: Type.String(),
});
