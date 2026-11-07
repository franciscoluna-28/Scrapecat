import { cn } from "@/src/shared/lib/utils";
import type { ReportSchedule } from "@/src/_features/reports/services/reports-api";

type Props = {
  schedule: ReportSchedule;
};

const DOT = "size-1.5 shrink-0 rounded-full";

/**
 * Quiet status on the context line — same weight as the repository
 * list's "Connected". The dot carries color; the label carries meaning,
 * so state is never signalled by color alone.
 */
function Status({
  className,
  dot,
  children,
}: {
  className?: string;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs",
        className,
      )}
    >
      <span aria-hidden className={cn(DOT, dot)} />
      {children}
    </span>
  );
}

export function ScheduleStatusBadge({ schedule }: Props) {
  if (!schedule.enabled) {
    return (
      <Status className="text-muted-foreground" dot="bg-muted-foreground/60">
        Paused
      </Status>
    );
  }
  if (schedule.lastStatus === "running") {
    return (
      <Status className="text-foreground" dot="bg-primary animate-pulse">
        Running
      </Status>
    );
  }
  if (schedule.lastStatus === "failed") {
    return (
      <Status className="text-destructive" dot="bg-destructive">
        Failed
      </Status>
    );
  }
  if (schedule.lastStatus === "succeeded") {
    return (
      <Status className="text-muted-foreground" dot="bg-primary">
        Succeeded
      </Status>
    );
  }
  return (
    <Status className="text-muted-foreground" dot="bg-muted-foreground/60">
      Scheduled
    </Status>
  );
}
