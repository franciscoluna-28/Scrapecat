"use client";

import { useState, useMemo } from "react";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitCommit, Search } from "lucide-react";
import type { StoredCommit } from "@/src/shared/types";

type CommitCardProps = {
  commits: StoredCommit[];
};

function CommitCardItem({ commit }: { commit: StoredCommit }) {
  return (
    <Card key={commit.id || commit.commitSha} className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <GitCommit className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed line-clamp-2">
              {commit.commitMessage}
            </p>
            {commit.commitSha && (
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                {commit.commitSha.slice(0, 7)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pl-5">
          <span className="text-xs text-muted-foreground truncate">
            {commit.author ?? "Unknown"}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">
            {new Date(commit.committedAt).toLocaleDateString("en-US")}
          </span>
        </div>
        {commit.diffSummary && (
          <details className="mt-2 pl-5">
            <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-foreground">
              View diff
            </summary>
            <pre className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70 whitespace-pre-wrap rounded-md bg-muted/60 p-2 overflow-x-auto max-h-40 overflow-y-auto">
              {commit.diffSummary}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function CommitCard({ commits }: CommitCardProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      commits.filter(
        (c) =>
          c.commitMessage.toLowerCase().includes(search.toLowerCase()) ||
          (c.author ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [commits, search],
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search commits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm bg-background"
          />
        </div>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {search ? "No commits match your search" : "No commits found"}
          </p>
        ) : (
          filtered.map((commit) => (
            <CommitCardItem key={commit.id || commit.commitSha} commit={commit} />
          ))
        )}
      </div>
    </div>
  );
}
