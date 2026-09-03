"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/src/shared/api/client";
import { useReportJobStream } from "@/src/_features/reports/services/reports-api";
import { useAISettings } from "@/src/shared/services/ai-settings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/shared/services/keys";
import { Message, MessageContent } from "@/src/components/ai-elements/message";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@/src/components/ai-elements/task";

type Props = {
  projectId: string;
  repositoryName: string;
  providerOwner: string;
  providerProjectId: string;
  branch: string | null;
  sessionId?: string;
};

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

export function ReportFormMessage({
  projectId,
  repositoryName,
  providerOwner,
  providerProjectId,
  branch,
  sessionId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const toastedJobId = useRef<string | null>(null);
  const { settings: aiSettings } = useAISettings();
  const { job } = useReportJobStream(jobId ?? undefined);

  const isDone = job?.status === "succeeded" && !!job.reportId;

  useEffect(() => {
    if (isDone) {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.list(projectId) });
      const t = setTimeout(() => router.push(`/app/reports/${job.reportId}`), 1500);
      return () => clearTimeout(t);
    } else if (
      job?.status === "failed" &&
      toastedJobId.current !== job.jobId
    ) {
      toastedJobId.current = job.jobId;
      toast.error(job.error?.message ?? "Failed to generate report");
      setIsGenerating(false);
    }
  }, [job, router, projectId, queryClient, isDone]);

  const handleGenerate = async () => {
    if (!startDate || !branch) return;

    setIsGenerating(true);
    try {
      const d = new Date();
      const finalEndDate =
        endDate ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const res = await fetch(`${API_URL}/api/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            repository: repositoryName,
            gitProvider: "github",
            providerOwner,
            providerProjectId,
            branch,
            startDate,
            endDate: finalEndDate,
            customInstructions: customInstructions || undefined,
            sessionId: sessionId || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to generate report");
        setIsGenerating(false);
        return;
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch {
      toast.error("Failed to generate report");
      setIsGenerating(false);
    }
  };

  return (
    <Message from="assistant">
      <MessageContent>
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-muted-foreground" />
            <h3 className="font-medium text-sm">Generate Report</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Create a comprehensive report for <strong>{repositoryName}</strong>
            {branch && <> on <strong>{branch}</strong></>}.
          </p>

          {!isGenerating && !isDone && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={<span>Start Date <span className="text-red-500">*</span></span>}
                    date={startDate ? parseISO(startDate) : undefined}
                    onSelect={(date) =>
                      setStartDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    disabled={(date) => date > new Date()}
                  />
                </div>
                <div>
                  <DatePicker
                    label="End Date"
                    date={endDate ? parseISO(endDate) : undefined}
                    onSelect={(date) =>
                      setEndDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    disabled={(date) =>
                      date > new Date() ||
                      (startDate ? date < new Date(startDate) : false)
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <p className="text-sm font-medium">{branch ?? "No branch selected"}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Model:{" "}
                  <span className="font-medium">
                    {aiSettings
                      ? `${aiSettings.reportModel} · ${aiSettings.reportProvider}`
                      : "Loading..."}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instructions" className="text-sm font-medium">
                  Custom AI Instructions
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="e.g., Focus on infrastructure, Highlight security changes"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="min-h-20 resize-none"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!startDate || !branch}
                className="w-full"
              >
                <FileText className="size-4" />
                Generate Report
              </Button>
            </div>
          )}

          {isGenerating && !isDone && (
            <Task defaultOpen={true}>
              <TaskTrigger title="Generating report..." />
              <TaskContent>
                <TaskItem>
                  <Loader2 className="size-3 animate-spin" />
                  {job?.phase === "generation" ? "Generating report..." : "Ingesting repository..."}
                </TaskItem>
                {job?.progress && (
                  <TaskItem>
                    <span className="text-xs text-muted-foreground">{job.progress}</span>
                  </TaskItem>
                )}
              </TaskContent>
            </Task>
          )}

          {isDone && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="size-4" />
              Report generated! Redirecting...
            </div>
          )}
        </div>
      </MessageContent>
    </Message>
  );
}