"use client";

import {
  MoreHorizontal,
  Pause,
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
  cadenceLabel,
  formatRelativeTime,
  formatUtcWithLocal,
} from "@/src/_features/reports/lib/time";

type Props = {
  schedule: ReportSchedule;
  isRunning: boolean;
  onRun: (schedule: ReportSchedule) => void;
  onEdit: (schedule: ReportSchedule) => void;
  onToggle: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
};

export function ScheduleCard({
  schedule,
  isRunning,
  onRun,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const nextRun = formatUtcWithLocal(schedule.nextRunAt);
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
          {cadenceLabel(schedule)}
        </CardDescription>
        <CardAction>
          <ScheduleStatusBadge schedule={schedule} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
        <p>
          Next run: <span className="text-foreground">{nextRun.utc}</span>
        </p>
        <p>{nextRun.local} your time</p>
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
            <DropdownMenuItem onSelect={() => onToggle(schedule)}>
              {schedule.enabled ? <Pause /> : <Play />}
              {schedule.enabled ? "Pause" : "Resume"}
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
