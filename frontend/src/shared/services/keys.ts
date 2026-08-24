export const queryKeys = {
  models: {
    all: ["models"] as const,
    list: (provider?: string, modality?: "chat" | "embeddings") =>
      ["models", "list", { provider, modality }] as const,
  },
  settings: {
    all: ["settings"] as const,
    ai: ["settings", "ai"] as const,
  },
  reports: {
    all: ["reports"] as const,
    list: (projectId?: string) => ["reports", "list", { projectId }] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
    job: (jobId?: string) => ["reports", "job", jobId] as const,
    commits: (id: string, q?: string) => ["reports", "commits", id, { q }] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: ["projects", "list"] as const,
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
  commits: {
    all: ["commits"] as const,
    list: (
      owner: string,
      repo: string,
      params?: { startDate?: string; endDate?: string; branch?: string },
    ) => ["commits", "list", owner, repo, params] as const,
    count: (
      owner: string,
      repo: string,
      params?: { startDate?: string; endDate?: string; branch?: string },
    ) => ["commits", "count", owner, repo, params] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (owner: string, repo: string) => ["branches", "list", owner, repo] as const,
  },
  credentials: {
    all: ["credentials"] as const,
  },
};
