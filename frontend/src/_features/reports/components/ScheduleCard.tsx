"use client";

import {
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { ScheduleStatusBadge } from "@/src/_features/reports/components/ScheduleStatusBadge";
import type { ReportSchedule } from "@/src/_features/reports/services/reports-api";
import {
  formatInTimeZone,
  formatRelativeTime,
  formatUtc,
  localCadenceLabel,
} from "@/src/_features/reports/lib/time";

type Props = {
  schedule: ReportSchedule;
  isRunning: boolean;
  onRun: (schedule: ReportSchedule) => void;
  onEdit: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
};

export function ScheduleCard({
  schedule,
  isRunning,
  onRun,
  onEdit,
  onDelete,
}: Props) {
  const nextRun = formatInTimeZone(
    schedule.nextRunAt,
    schedule.timezone,
  );
  const nextRunUtc = formatUtc(schedule.nextRunAt);
  const lastRun = schedule.lastRunAt
    ? formatRelativeTime(schedule.lastRunAt)
    : "never";

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="truncate">
          {schedule.providerOwner}/{schedule.repositoryName}
          <span className="text-muted-foreground"> · {schedule.branch}</span>
        </CardTitle>
        <CardDescription>
          {localCadenceLabel({
            cadence: schedule.cadence,
            nextRunAt: schedule.nextRunAt,
            timezone: schedule.timezone,
          })}
        </CardDescription>
        <CardAction>
          <ScheduleStatusBadge schedule={schedule} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
        <p>
          Next run: <span className="text-foreground">{nextRun}</span> (
          {schedule.timezone})
        </p>
        <p>UTC: {nextRunUtc}</p>
        <p>
          Last run: <span className="text-foreground">{lastRun}</span>
        </p>
        {schedule.lastError && (
          <p className="line-clamp-2 text-destructive">{schedule.lastError}</p>
        )}
      </CardContent>

      <CardFooter className="justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRun(schedule)}
          disabled={isRunning || schedule.lastStatus === "running"}
        >
          <Play data-icon="inline-start" />
          Run now
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Schedule actions"
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
      </CardFooter>
    </Card>
  );
}
