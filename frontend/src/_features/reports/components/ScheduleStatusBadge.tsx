import { Badge } from "@/src/components/ui/badge";
import type { ReportSchedule } from "@/src/_features/reports/services/reports-api";

type Props = {
  schedule: ReportSchedule;
};

export function ScheduleStatusBadge({ schedule }: Props) {
  if (!schedule.enabled) {
    return <Badge variant="outline">Paused</Badge>;
  }
  if (schedule.lastStatus === "running") {
    return <Badge variant="secondary">Running</Badge>;
  }
  if (schedule.lastStatus === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (schedule.lastStatus === "succeeded") {
    return <Badge>Recent success</Badge>;
  }
  return <Badge variant="outline">Scheduled</Badge>;
}
