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
  browserTimeZone,
  cadenceSummary,
  formatHourLocal,
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
  const [hour, setHour] = useState(schedule?.hour ?? 9);
  const timezone = schedule?.timezone ?? browserTimeZone();

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

  const changeProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const project = projects.find((item) => item.id === nextProjectId);
    setBranch(project?.defaultBranch ?? "");
  };

  const submit = async () => {
    if (!projectId || !branch) return;

    try {
      if (schedule) {
        await updateMutation.mutateAsync({
          id: schedule.id,
          schedule: { cadence, dayOfWeek, hour, timezone },
        });
      } else {
        await createMutation.mutateAsync({
          projectId,
          branch,
          cadence,
          dayOfWeek,
          hour,
          timezone,
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
            Times use {timezone}. Daily reports run Monday–Friday.
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
              <SelectTrigger className="w-full" aria-label="Project">
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
              <SelectTrigger className="w-full" aria-label="Branch">
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
              onValueChange={(value) => setCadence(value as Cadence)}
            >
              <SelectTrigger className="w-full" aria-label="Cadence">
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
                onValueChange={(value) => setDayOfWeek(Number(value))}
              >
                <SelectTrigger className="w-full" aria-label="Day of week">
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
            <Label>Time</Label>
            <Select
              value={String(hour)}
              onValueChange={(value) => setHour(Number(value))}
            >
              <SelectTrigger className="w-full" aria-label="Time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hourOption) => (
                  <SelectItem key={hourOption} value={String(hourOption)}>
                    {formatHourLocal(hourOption)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {cadenceSummary({ cadence, dayOfWeek, hour, timezone })}
            </p>
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
