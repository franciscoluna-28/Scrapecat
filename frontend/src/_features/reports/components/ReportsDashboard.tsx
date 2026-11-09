"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { Skeleton } from "@/src/components/ui/skeleton";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { ScheduleCard } from "@/src/_features/reports/components/ScheduleCard";
import { ScheduleDialog } from "@/src/_features/reports/components/ScheduleDialog";
import { ReportFeed } from "@/src/_features/reports/components/ReportFeed";
import { ReportDetailSheet } from "@/src/_features/reports/components/ReportDetailSheet";
import {
  useDeleteReportSchedule,
  useReportSchedules,
  useRunReportSchedule,
  type ReportSchedule,
  type ReportSummary,
} from "@/src/_features/reports/services/reports-api";
import { queryKeys } from "@/src/shared/services/keys";
import { errorMessage } from "@/src/shared/api/client";

export function ReportsDashboard() {
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const {
    schedules,
    isLoading: schedulesLoading,
    error,
    refetch,
  } = useReportSchedules();
  const runMutation = useRunReportSchedule();
  const deleteMutation = useDeleteReportSchedule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const running = schedules.some(
    (schedule) => schedule.lastStatus === "running",
  );
  const wasRunning = useRef(running);

  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    }
    wasRunning.current = running;
  }, [queryClient, running]);

  const openNew = () => {
    setEditing(null);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const openEdit = (schedule: ReportSchedule) => {
    setEditing(schedule);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const openReport = (report: ReportSummary) => {
    setSelectedReportId(report.id);
    setReportOpen(true);
  };

  const handleRun = (schedule: ReportSchedule) => {
    runMutation.mutate(schedule.id);
  };

  const handleDelete = (schedule: ReportSchedule) => {
    deleteMutation.mutate(schedule.id);
  };

  if (projectsLoading || schedulesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AddRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onProjectSelected={() => {
          setConnectOpen(false);
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        }}
      />

      <ScheduleDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        schedule={editing}
        onConnectRepository={() => setConnectOpen(true)}
      />

      <ReportDetailSheet
        reportId={selectedReportId}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {projects.length === 0 ? (
        <Empty className="min-h-[360px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClock />
            </EmptyMedia>
            <EmptyTitle>No projects connected</EmptyTitle>
            <EmptyDescription>
              Connect a repository before creating a summary schedule.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setConnectOpen(true)}>
              <Plus data-icon="inline-start" />
              Connect repository
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openNew}>
            <Plus data-icon="inline-start" />
            New schedule
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">
              {errorMessage(error, "Failed to load schedules")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Schedules</h2>

        {schedules.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock />
              </EmptyMedia>
              <EmptyTitle>No schedules yet</EmptyTitle>
              <EmptyDescription>
                Add a project branch and choose a daily or weekly cadence.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openNew}>
                <Plus data-icon="inline-start" />
                Create schedule
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                isRunning={
                  runMutation.isPending &&
                  runMutation.variables === schedule.id
                }
                onRun={handleRun}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Reports</h2>
          {running && (
            <span className="text-xs text-muted-foreground">
              Updating…
            </span>
          )}
        </div>
        <ReportFeed onOpen={openReport} />
      </section>
        </>
      )}
    </div>
  );
}
