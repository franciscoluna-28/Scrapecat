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
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <GitCommit className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed line-clamp-3 [overflow-wrap:anywhere]">
              {commit.commitMessage}
            </p>
            {commit.commitSha && (
              <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
                {commit.commitSha.slice(0, 7)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pl-5 gap-2">
          <span className="text-xs text-muted-foreground truncate min-w-0">
            {commit.author ?? "Unknown"}
          </span>
          <span className="text-[11px] text-muted-foreground/60 shrink-0">
            {new Date(commit.committedAt).toLocaleDateString("en-US")}
          </span>
        </div>
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
