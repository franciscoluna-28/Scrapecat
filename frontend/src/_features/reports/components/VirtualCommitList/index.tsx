"use client";

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { GitCommit, Search, Loader2 } from "lucide-react";
import type { StoredCommit } from "@/src/shared/types";
import { useReportCommitsInfinite } from "@/src/_features/reports/services/reports-api";

const ROW_ESTIMATE = 108; // initial guess; actual heights are measured

function useDebouncedValue(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function CommitRow({ commit }: { commit: StoredCommit }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <GitCommit className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed line-clamp-3 [wrap:anywhere]">
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

export function VirtualCommitList({ reportId }: { reportId: string }) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300) || undefined;

  const {
    commits,
    total,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useReportCommitsInfinite(reportId, q);

  const scrollRef = useRef<HTMLDivElement>(null);

  // +1 always reserves a footer row with the "load more" button / end state.
  const virtualizer = useVirtualizer({
    count: commits.length + 1,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: (index) =>
      index === commits.length ? "footer" : commits[index].id,
  });

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Source Commits
          </h3>
          {total !== null && (
            <Badge variant="secondary" className="text-xs">
              {total} audited
            </Badge>
          )}
        </div>
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

      <div className="flex-1 min-h-0 px-4 py-3">
        {isLoading ? (
          <div className="text-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-10">
            Failed to load commits
          </p>
        ) : commits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {q ? "No commits match your search" : "No commits found"}
          </p>
        ) : (
          <div ref={scrollRef} className="h-full overflow-y-auto pr-1">
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((item) =>
                item.index === commits.length ? (
                  <div
                    key="footer"
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                    }}
                    className="flex items-center justify-center py-6"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : hasNextPage ? (
                      <Button variant="outline" size="sm" onClick={loadMore}>
                        Load more
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">
                        End of results
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    key={commits[item.index].id}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",  
                      transform: `translateY(${item.start}px)`,
                      paddingBottom: 6,
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 6,
                    }}
                  >
                    <CommitRow commit={commits[item.index]} />
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
