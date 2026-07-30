export const queryKeys = {
  models: {
    all: ["models"] as const,
    list: (provider?: string) => ["models", "list", { provider }] as const,
  },
  reports: {
    all: ["reports"] as const,
    list: (projectId?: number) => ["reports", "list", { projectId }] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
  },
  repositories: {
    all: ["repositories"] as const,
    list: (filters: {
      type: string;
      sort: string;
      direction: string;
      per_page: number;
    }) => ["repositories", "list", filters] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (owner: string, repo: string) => ["branches", "list", owner, repo] as const,
  },
  commits: {
    all: ["commits"] as const,
    list: (
      owner: string,
      repo: string,
      params?: { startDate?: string; endDate?: string; branch?: string },
    ) => ["commits", "list", owner, repo, params] as const,
  },
  credentials: {
    all: ["credentials"] as const,
  },
};
