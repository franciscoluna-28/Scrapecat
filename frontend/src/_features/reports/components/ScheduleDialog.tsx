"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { useBranches } from "@/src/_features/git-providers/services/git-providers-api";
import {
  useCreateReportSchedule,
  useUpdateReportSchedule,
  type ReportSchedule,
} from "@/src/_features/reports/services/reports-api";
import {
  computeNextRun,
  formatHourUtc,
  formatInTimeZone,
  WEEKDAYS,
  type Cadence,
} from "@/src/_features/reports/lib/time";
import { errorMessage } from "@/src/shared/api/client";
import type { GitProviderId } from "@/src/shared/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ReportSchedule | null;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function ScheduleDialog({ open, onOpenChange, schedule }: Props) {
  const { projects } = useProjects();
  const initialProject = projects[0];
  const [projectId, setProjectId] = useState(
    schedule?.projectId ?? initialProject?.id ?? "",
  );
  const [branch, setBranch] = useState(
    schedule?.branch ?? initialProject?.defaultBranch ?? "",
  );
  const [cadence, setCadence] = useState<Cadence>(
    schedule?.cadence ?? "daily",
  );
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.dayOfWeek ?? 5);
  const [hourUtc, setHourUtc] = useState(schedule?.hourUtc ?? 9);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [localPreview, setLocalPreview] = useState(() =>
    formatInTimeZone(
      computeNextRun({
        cadence: schedule?.cadence ?? "daily",
        dayOfWeek: schedule?.dayOfWeek ?? 5,
        hourUtc: schedule?.hourUtc ?? 9,
      }),
    ),
  );

  const createMutation = useCreateReportSchedule();
  const updateMutation = useUpdateReportSchedule();
  const isEditing = !!schedule;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );

  const owner =
    selectedProject?.providerOwner ?? schedule?.providerOwner ?? "";
  const repo =
    selectedProject?.repositoryName ?? schedule?.repositoryName ?? "";
  const provider = (selectedProject?.gitProvider ??
    schedule?.gitProvider) as GitProviderId | undefined;
  const { branches, isLoading: branchesLoading } = useBranches(
    owner,
    repo,
    provider,
  );

  const branchOptions = useMemo(() => {
    const values = [
      branch,
      selectedProject?.defaultBranch,
      ...(selectedProject?.indexedBranches ?? []),
      ...branches,
    ].filter((value): value is string => !!value);
    return Array.from(new Set(values));
  }, [branch, branches, selectedProject]);

  const updatePreview = (input: {
    cadence: Cadence;
    dayOfWeek: number;
    hourUtc: number;
  }) => {
    setLocalPreview(formatInTimeZone(computeNextRun(input)));
  };

  const changeProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const project = projects.find((item) => item.id === nextProjectId);
    setBranch(project?.defaultBranch ?? "");
  };

  const changeCadence = (value: Cadence) => {
    setCadence(value);
    updatePreview({ cadence: value, dayOfWeek, hourUtc });
  };

  const changeDayOfWeek = (value: number) => {
    setDayOfWeek(value);
    updatePreview({ cadence, dayOfWeek: value, hourUtc });
  };

  const changeHourUtc = (value: number) => {
    setHourUtc(value);
    updatePreview({ cadence, dayOfWeek, hourUtc: value });
  };

  const submit = async () => {
    if (!projectId || !branch) return;

    try {
      if (schedule) {
        await updateMutation.mutateAsync({
          id: schedule.id,
          schedule: { cadence, dayOfWeek, hourUtc, enabled },
        });
      } else {
        await createMutation.mutateAsync({
          projectId,
          branch,
          cadence,
          dayOfWeek,
          hourUtc,
          enabled,
        });
      }
      onOpenChange(false);
    } catch {
      return;
    }
  };

  const error = createMutation.error ?? updateMutation.error;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit summary schedule" : "New summary schedule"}
          </DialogTitle>
          <DialogDescription>
            Summaries run from UTC hours. The local time is shown as a preview.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={changeProject}
              disabled={isEditing}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.providerOwner}/{project.repositoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Connect a repository before creating a schedule.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              value={branch}
              onValueChange={setBranch}
              disabled={isEditing || !projectId}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    branchesLoading ? "Loading branches…" : "Select a branch"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cadence</Label>
            <Select
              value={cadence}
              onValueChange={(value) => changeCadence(value as Cadence)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cadence === "weekly" && (
            <div className="space-y-1.5">
              <Label>Day of week</Label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(value) => changeDayOfWeek(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Hour (UTC)</Label>
            <Select
              value={String(hourUtc)}
              onValueChange={(value) => changeHourUtc(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatHourUtc(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localPreview && (
              <p className="text-xs text-muted-foreground">
                Next occurrence: {localPreview} your time
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Paused schedules keep their configuration.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={enabled ? "secondary" : "outline"}
              onClick={() => setEnabled((value) => !value)}
            >
              {enabled ? "Enabled" : "Paused"}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive">
              {errorMessage(error, "Failed to save schedule")}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectId || !branch || isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
