"use client";

import { useState } from "react";
import { Activity, GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { Skeleton } from "@/src/components/ui/skeleton";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import {
  useIngestionRuns,
  type IngestionRun,
} from "@/src/_features/reports/services/reports-api";
import {
  formatDuration,
  formatRelativeTime,
  formatTokenUsage,
} from "@/src/_features/reports/lib/time";
import { errorMessage } from "@/src/shared/api/client";
import { IS_DEMO } from "@/src/shared/constants";
import { cn } from "@/src/shared/lib/utils";

const CHIP =
  "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground";

function runLabel(run: IngestionRun): string {
  if (run.jobType === "reindex-embeddings") return "Embedding reindex";
  return run.repositoryName && run.providerOwner
    ? `${run.providerOwner}/${run.repositoryName}`
    : "Unknown repository";
}

function runMeta(run: IngestionRun): string {
  const parts: string[] = [];

  if (run.jobType === "reindex-embeddings") {
    if (run.commitsEmbedded !== null) {
      parts.push(`${run.commitsEmbedded} re-embedded`);
    }
  } else if (run.commitsWritten !== null) {
    parts.push(`${run.commitsWritten} commits`);
  }

  if (
    run.embeddingInputTokens !== null ||
    run.embeddingOutputTokens !== null
  ) {
    parts.push(
      formatTokenUsage(run.embeddingInputTokens, run.embeddingOutputTokens),
    );
  }
  if (run.gitMs !== null) parts.push(`git ${formatDuration(run.gitMs)}`);
  if (run.dbMs !== null) parts.push(`db ${formatDuration(run.dbMs)}`);

  return parts.join(" · ");
}

function RunStatus({ status }: { status: IngestionRun["status"] }) {
  const failed = status === "failed";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs",
        failed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", failed ? "bg-destructive" : "bg-primary")}
      />
      {failed ? "Failed" : "Succeeded"}
    </span>
  );
}

function RunRow({
  run,
  onInspect,
}: {
  run: IngestionRun;
  onInspect: (run: IngestionRun) => void;
}) {
  const isGlobal = run.jobType === "reindex-embeddings";
  const label = runLabel(run);
  const meta = runMeta(run);
  const metaTitle = [meta, run.embeddingModel].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm text-card-foreground">
      {run.gitProvider ? (
        <GitProviderIcon
          provider={run.gitProvider}
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : (
        <Activity
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-medium" title={label}>
            {label}
          </p>
          {run.branch && (
            <span className={cn(CHIP, "shrink-0")}>
              <GitBranch className="size-3" aria-hidden />
              <span className="max-w-24 truncate">{run.branch}</span>
            </span>
          )}
          {isGlobal && (
            <span className={cn(CHIP, "shrink-0")}>all repositories</span>
          )}
        </div>

        <p className="truncate text-xs text-muted-foreground" title={metaTitle}>
          {meta}
        </p>

        {run.errorMessage && (
          <p
            role="alert"
            className="line-clamp-1 text-xs text-destructive"
            title={run.errorMessage}
          >
            {run.errorMessage}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <RunStatus status={run.status} />
        <span className="whitespace-nowrap">{formatDuration(run.durationMs)}</span>
        <span className="hidden whitespace-nowrap sm:inline">
          {formatRelativeTime(run.startedAt)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => onInspect(run)}
        >
          See more
        </Button>
      </div>
    </div>
  );
}

function IngestionRunsContent() {
  const { runs, summary, isLoading, error, refetch } = useIngestionRuns();
  const [selected, setSelected] = useState<IngestionRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Ingestion activity</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">
              {errorMessage(error, "Failed to load ingestion runs")}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Ingestion activity</h2>
        {summary && (
          <span className="text-xs text-muted-foreground">
            Last {summary.windowDays}d
          </span>
        )}
      </div>

      {summary && summary.runs > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={CHIP}>{summary.runs} runs</span>
          <span className={CHIP}>{summary.commitsProcessed} commits</span>
          <span className={CHIP}>
            {summary.embeddingInputTokens === null &&
            summary.embeddingOutputTokens === null
              ? "tokens —"
              : formatTokenUsage(
                  summary.embeddingInputTokens,
                  summary.embeddingOutputTokens,
                )}
          </span>
          {summary.failedRuns > 0 && (
            <span className={cn(CHIP, "text-destructive")}>
              {summary.failedRuns} failed
            </span>
          )}
        </div>
      )}

      {runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>No ingestion runs yet</EmptyTitle>
            <EmptyDescription>
              Runs appear after a repository branch is synced. Reindexing
              embeddings also shows up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              onInspect={(next) => {
                setSelected(next);
                setDetailsOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ingestion run</DialogTitle>
            <DialogDescription>
              Raw run data
              {selected
                ? ` · ${runLabel(selected)} · ${formatRelativeTime(selected.startedAt)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
              {JSON.stringify(selected, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Demo deployments have no telemetry access; never mount (or fetch) the UI. */
export function IngestionRunsSection() {
  if (IS_DEMO) return null;
  return <IngestionRunsContent />;
}
