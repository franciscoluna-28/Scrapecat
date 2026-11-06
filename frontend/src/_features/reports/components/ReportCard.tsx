"use client";

import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ReportSummary } from "@/src/_features/reports/services/reports-api";
import {
  formatPeriod,
  formatRelativeTime,
  summaryPreview,
} from "@/src/_features/reports/lib/time";

type Props = {
  report: ReportSummary;
  onOpen: (report: ReportSummary) => void;
};

export function ReportCard({ report, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="w-full text-left"
    >
      <Card
        size="sm"
        className="transition-colors hover:ring-foreground/20"
      >
        <CardHeader>
          <CardTitle className="truncate">
            {report.providerOwner}/{report.repositoryName}
            <span className="text-muted-foreground"> · {report.branch}</span>
          </CardTitle>
          <CardDescription>
            {formatPeriod(report.periodStart, report.periodEnd)} ·{" "}
            {formatRelativeTime(report.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {summaryPreview(report.summary)}
            </p>
            <p className="text-xs text-muted-foreground">
              {report.provider && report.model
                ? `${report.provider}/${report.model}`
                : "No model used"}
            </p>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </button>
  );
}
