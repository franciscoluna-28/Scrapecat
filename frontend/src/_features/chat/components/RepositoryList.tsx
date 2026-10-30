"use client";

import { ScrollArea } from "@/src/components/ui/scroll-area";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import type { GitProviderRepositoryItem } from "@/src/shared/types";

type RepositoryListProps = {
  repositories: GitProviderRepositoryItem[];
  isLoading: boolean;
  /** Composite `${provider}:${repoId}` keys — ids are only unique per host. */
  existingProjectIds: Set<string>;
  connecting: boolean;
  onSelect: (repo: GitProviderRepositoryItem) => void;
};

export function RepositoryList({
  repositories,
  isLoading,
  existingProjectIds,
  connecting,
  onSelect,
}: RepositoryListProps) {
  return (
    <ScrollArea className="h-64">
      <div className="space-y-1 pr-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading repositories...
          </p>
        ) : repositories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No repositories found. Check your git provider token.
          </p>
        ) : (
          repositories.map((repo) => {
            const key = `${repo.provider}:${repo.id}`;
            const isConnected = existingProjectIds.has(key);
            return (
              <button
                key={key}
                onClick={() => onSelect(repo)}
                disabled={connecting}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                <GitProviderIcon
                  provider={repo.provider}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">
                    {repo.owner.login}/{repo.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {repo.default_branch ?? "main"}
                    {isConnected && " · Already connected"}
                  </p>
                </div>
                {isConnected && (
                  <span className="text-xs text-muted-foreground">
                    Connected
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
