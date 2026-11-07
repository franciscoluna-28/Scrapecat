"use client";

import {
  AlertTriangle,
  CalendarClock,
  GitBranch,
  History,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import { ScheduleStatusBadge } from "@/src/_features/reports/components/ScheduleStatusBadge";
import type { ReportSchedule } from "@/src/_features/reports/services/reports-api";
import {
  browserTimeZone,
  formatNextRun,
  formatNextRunRelative,
  formatRelativeTime,
  formatUtc,
  friendlyTimeZoneLabel,
  localCadenceLabel,
} from "@/src/_features/reports/lib/time";

type Props = {
  schedule: ReportSchedule;
  isRunning: boolean;
  onRun: (schedule: ReportSchedule) => void;
  onEdit: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
};

/**
 * One schedule as a repository-picker row: provider icon, project, branch,
 * a one-line cadence summary, then actions. Exact times live in a details
 * popover so the row stays as light as the connect-repository cards.
 */
export function ScheduleCard({
  schedule,
  isRunning,
  onRun,
  onEdit,
  onDelete,
}: Props) {
  const timezone = schedule.timezone || browserTimeZone();
  const busy = isRunning || schedule.lastStatus === "running";
  const repoFullName = `${schedule.providerOwner}/${schedule.repositoryName}`;
  const cadence = localCadenceLabel({
    cadence: schedule.cadence,
    nextRunAt: schedule.nextRunAt,
    timezone,
  });

  const relative = formatNextRunRelative(schedule.nextRunAt);
  const nextHint =
    relative === "Due now" || relative === "Overdue"
      ? relative.toLowerCase()
      : `next ${relative}`;

  return (
    <div
      aria-busy={busy}
      className="rounded-lg border bg-card px-3 py-2.5 text-sm text-card-foreground"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <GitProviderIcon
            provider={schedule.gitProvider}
            className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0"
          />

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p
                className="min-w-0 truncate font-medium"
                title={`${repoFullName} · ${schedule.branch}`}
              >
                <span className="text-muted-foreground">
                  {schedule.providerOwner}/
                </span>
                {schedule.repositoryName}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <GitBranch className="size-3" aria-hidden />
                <span className="max-w-24 truncate">{schedule.branch}</span>
              </span>
            </div>

            <p className="truncate text-xs text-muted-foreground">
              {cadence} · {friendlyTimeZoneLabel(timezone)} · {nextHint}
            </p>

            {!schedule.timezone && (
              <p
                role="status"
                className="flex items-start gap-1.5 text-xs text-destructive"
              >
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <span>
                  Missing timezone data. Edit the schedule to set your timezone.
                </span>
              </p>
            )}
            {schedule.lastError && (
              <p
                role="alert"
                className="flex items-start gap-1.5 text-xs text-destructive"
                title={schedule.lastError}
              >
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <span className="line-clamp-2">{schedule.lastError}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <ScheduleStatusBadge schedule={schedule} />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
              >
                <Info />
                Details
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4">
              <div className="space-y-3">
                <div className="flex gap-2.5">
                  <CalendarClock
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Next run</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatNextRun(schedule.nextRunAt, timezone)}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {formatUtc(schedule.nextRunAt)} · {timezone}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 border-t pt-3">
                  <History
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Last run</p>
                    <p className="text-sm text-foreground">
                      {schedule.lastRunAt
                        ? formatRelativeTime(schedule.lastRunAt)
                        : "Never"}
                    </p>
                    {schedule.lastRunAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatUtc(schedule.lastRunAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRun(schedule)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {isRunning ? "Starting…" : busy ? "Running…" : "Run now"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Schedule actions for ${repoFullName}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(schedule)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(schedule)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
