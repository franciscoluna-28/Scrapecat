"use client";

import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ReportCard } from "@/src/_features/reports/components/ReportCard";
import {
  useReports,
  type ReportSchedule,
  type ReportSummary,
} from "@/src/_features/reports/services/reports-api";
import { errorMessage } from "@/src/shared/api/client";

type Props = {
  schedules: ReportSchedule[];
  onOpen: (report: ReportSummary) => void;
};

export function ReportFeed({ schedules, onOpen }: Props) {
  const { reports, isLoading, error, refetch } = useReports();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-destructive">
            {errorMessage(error, "Failed to load reports")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No reports yet</EmptyTitle>
          <EmptyDescription>
            Reports appear after a schedule runs. You can run a schedule manually
            to generate the first one now.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          schedule={schedules.find(
            (schedule) =>
              schedule.projectId === report.projectId &&
              schedule.branch === report.branch,
          )}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
