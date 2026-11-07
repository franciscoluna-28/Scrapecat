"use client";

import { ChevronRight, GitBranch } from "lucide-react";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import type { ReportSummary } from "@/src/_features/reports/services/reports-api";
import {
  formatPeriodDate,
  formatRelativeTime,
  summaryPreview,
} from "@/src/_features/reports/lib/time";

type Props = {
  report: ReportSummary;
  onOpen: (report: ReportSummary) => void;
};

/**
 * One report as a repository-picker row: provider icon, project + branch,
 * period, and a two-line summary preview. The full report opens in a modal.
 */
export function ReportCard({ report, onOpen }: Props) {
  const repoFullName = `${report.providerOwner}/${report.repositoryName}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="w-full text-left"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm text-card-foreground transition-colors hover:bg-accent">
        <GitProviderIcon
          provider={report.gitProvider}
          className="size-4 shrink-0 text-muted-foreground"
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className="min-w-0 truncate font-medium"
              title={`${repoFullName} · ${report.branch}`}
            >
              <span className="text-muted-foreground">
                {report.providerOwner}/
              </span>
              {report.repositoryName}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <GitBranch className="size-3" aria-hidden />
              <span className="max-w-24 truncate">{report.branch}</span>
            </span>
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {formatPeriodDate(report.periodStart, report.periodEnd)} ·{" "}
            {formatRelativeTime(report.createdAt)}
          </p>

          <p className="truncate text-xs text-muted-foreground">
            {summaryPreview(report.summary, 80)}
          </p>
        </div>

        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </div>
    </button>
  );
}
