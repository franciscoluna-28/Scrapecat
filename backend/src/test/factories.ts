import { vi } from "vitest";
import type { ChatCitation } from "@/db/schema";
import type {
  CommitChunkInput,
  CommitSearchResult,
} from "@/projects/stores/commit-chunks-store";
import type { SourceCommit } from "@/repositories/ingest";
import type { AISettingsInput } from "@/settings/schemas";
import type { AISettings } from "@/settings/services";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";
import type { Repository } from "@/shared/integrations/git-provider/types";

const DEFAULT_DATE = new Date("2026-01-01T00:00:00.000Z");

export function makeAISettings(overrides: Partial<AISettings> = {}): AISettings {
  return {
    chatProvider: "openrouter",
    chatModel: "openai/gpt-5.6-luna",
    embeddingProvider: "openrouter",
    embeddingModel: "openai/text-embedding-3-small",
    ...overrides,
  };
}

export function makeAISettingsInput(
  overrides: Partial<AISettings> = {},
): AISettingsInput {
  return {
    chatProvider: "openrouter",
    chatModel: "openai/gpt-5.6-luna",
    embeddingProvider: "openrouter",
    embeddingModel: "openai/text-embedding-3-small",
    ...overrides,
  } as AISettingsInput;
}

export function makeRepository(
  overrides: Partial<Repository> = {},
): Repository {
  return {
    id: "1",
    name: "repo",
    full_name: "owner/repo",
    owner: { login: "owner" },
    private: false,
    description: null,
    default_branch: "main",
    updated_at: DEFAULT_DATE.toISOString(),
    ...overrides,
  };
}

export function makeGitProviderMock(
  overrides: Partial<GitProvider> = {},
): GitProvider {
  return {
    listRepositories: vi.fn(async () => []),
    searchPublicRepositories: vi.fn(async () => []),
    listBranches: vi.fn(async () => []),
    getDefaultBranch: vi.fn(async () => "main"),
    getRepositoryId: vi.fn(async () => "1"),
    verifyConnection: vi.fn(async () => ({ login: "tester" })),
    ...overrides,
  };
}

export function makeSourceCommit(
  overrides: Partial<SourceCommit> = {},
): SourceCommit {
  return {
    sha: "abc123",
    message: "fix: handle empty commit",
    author: "dev",
    date: DEFAULT_DATE.toISOString(),
    parentSha: null,
    ...overrides,
  };
}

export function makeChunkInput(
  overrides: Partial<CommitChunkInput> = {},
): CommitChunkInput {
  return {
    projectId: "project-1",
    commitSha: "abc123",
    branch: "main",
    commitMessage: "fix: handle empty commit",
    author: "dev",
    metadata: {
      filesChanged: ["src/chat/routes.ts"],
      commitUrl: "https://github.com/owner/repo/commit/abc123",
    },
    committedAt: DEFAULT_DATE,
    ...overrides,
  };
}

export function makeChunkSearchResult(
  overrides: Partial<CommitSearchResult> = {},
): CommitSearchResult {
  return {
    id: "chunk-1",
    commitSha: "abc123",
    commitMessage: "fix: handle empty commit",
    author: "dev",
    committedAt: DEFAULT_DATE,
    metadata: {
      filesChanged: ["src/chat/routes.ts"],
      commitUrl: "https://github.com/owner/repo/commit/abc123",
    },
    distance: 0.2,
    ...overrides,
  };
}

export function makeCitation(
  overrides: Partial<ChatCitation> = {},
): ChatCitation {
  return {
    commitSha: "abc123",
    commitMessage: "fix: handle empty commit",
    author: "dev",
    committedAt: DEFAULT_DATE.toISOString(),
    filesChanged: ["src/chat/routes.ts"],
    commitUrl: "https://github.com/owner/repo/commit/abc123",
    ...overrides,
  };
}
