"use client";

import { ScrollArea } from "@/src/components/ui/scroll-area";
import { GitBranch } from "lucide-react";
import type { GitHubRepository } from "@/src/shared/types";

type RepositoryListProps = {
  repositories: GitHubRepository[];
  isLoading: boolean;
  existingProjectIds: Set<string>;
  connecting: boolean;
  onSelect: (repo: GitHubRepository) => void;
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
            No repositories found. Check your GITHUB_TOKEN.
          </p>
        ) : (
          repositories.map((repo) => {
            const isConnected = existingProjectIds.has(repo.id);
            return (
              <button
                key={repo.id}
                onClick={() => onSelect(repo)}
                disabled={connecting}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                <GitBranch className="size-4 shrink-0 text-muted-foreground" />
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
