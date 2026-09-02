"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/src/shared/api/client";
import { useReportJobStream } from "@/src/_features/reports/services/reports-api";
import { useAISettings } from "@/src/shared/services/ai-settings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/shared/services/keys";

type Props = {
  projectId: string;
  repositoryName: string;
  providerOwner: string;
  providerProjectId: string;
  branch: string | null;
  sessionId?: string;
  children?: React.ReactNode;
};

export function GenerateReportDialog({
  projectId,
  repositoryName,
  providerOwner,
  providerProjectId,
  branch,
  sessionId,
  children,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const toastedJobId = useRef<string | null>(null);
  const { settings: aiSettings } = useAISettings();
  const { job } = useReportJobStream(jobId ?? undefined);

  // Pre-fill dates: last 30 days by default
  useEffect(() => {
    if (!startDate && !endDate) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setStartDate(format(start, "yyyy-MM-dd"));
      setEndDate(format(end, "yyyy-MM-dd"));
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (job?.status === "succeeded" && job.reportId) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.list(projectId) });
      router.push(`/app/reports/${job.reportId}`);
    } else if (
      job?.status === "failed" &&
      toastedJobId.current !== job.jobId
    ) {
      toastedJobId.current = job.jobId;
      toast.error(job.error?.message ?? "Failed to generate report");
      setIsGenerating(false);
    }
  }, [job, router, projectId, queryClient]);

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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setJobId(null); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start"
            disabled={!branch}
          >
            <FileText className="size-4" />
            Generate report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Create a comprehensive report for <strong>{repositoryName}</strong>
            {branch && <> on <strong>{branch}</strong></>}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                label={
                  <>
                    Start Date <span className="text-red-500">*</span>
                  </>
                }
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
            <Label className="text-xs text-muted-foreground">
              Branch
            </Label>
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
            disabled={!startDate || !branch || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {job?.phase === "generation"
                  ? "Generating Report..."
                  : "Ingesting Repository..."}
              </>
            ) : (
              "Generate Report"
            )}
          </Button>

          {job && job.status !== "succeeded" && job.status !== "failed" && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {job.progress ?? "Ingesting repository..."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}