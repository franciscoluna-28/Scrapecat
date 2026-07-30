"use client";

import { useState, useMemo } from "react";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitCommit, Search } from "lucide-react";

type CommitInfo = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
};

type CommitCardProps = {
  commits: CommitInfo[];
};

function CommitCardItem({ commit }: { commit: CommitInfo }) {
  return (
    <Card key={commit.sha || commit.message} className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <GitCommit className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {commit.url ? (
              <a
                href={commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs leading-relaxed line-clamp-2 hover:underline"
              >
                {commit.message}
              </a>
            ) : (
              <p className="text-xs leading-relaxed line-clamp-2">
                {commit.message}
              </p>
            )}
            {commit.sha && (
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                {commit.sha.slice(0, 7)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pl-5">
          <span className="text-xs text-muted-foreground truncate">
            {commit.author}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">
            {commit.date}
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
          c.message.toLowerCase().includes(search.toLowerCase()) ||
          c.author.toLowerCase().includes(search.toLowerCase()),
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
            <CommitCardItem key={commit.sha || commit.message} commit={commit} />
          ))
        )}
      </div>
    </div>
  );
}
