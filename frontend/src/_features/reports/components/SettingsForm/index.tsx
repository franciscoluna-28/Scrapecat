"use client";

import { useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isToday } from "date-fns";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import { GitHubRepository } from "@/src/shared/types";
import { Book, Loader2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { apiClient } from "@/src/shared/api/client";
import { useReportJobStream } from "@/src/_features/reports/services/reports-api";
import { useCommits } from "@/src/_features/reports/services/api";
import { CommitsPreviewCard } from "@/src/_features/reports/components/CommitsPreviewCard";
import { PromptPresetsModal } from "@/src/components/PromptPresetsModal";
import { useAISettings } from "@/src/shared/services/ai-settings";

type Props = {
  repository: GitHubRepository;
  branches: string[];
  selectedBranch: string;
  startDate?: string;
  endDate?: string;
};

export function SettingsForm({
  repository,
  branches,
  selectedBranch,
  startDate,
  endDate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customInstructions, setCustomInstructions] = useState("");
  const [promptPresetsOpen, setPromptPresetsOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const toastedJobId = useRef<string | null>(null);
  const { settings: aiSettings } = useAISettings();
  const { job } = useReportJobStream(jobId ?? undefined);

  const {
    commits,
    count: commitCount,
    isFetching: commitsFetching,
    hasError: commitsError,
  } = useCommits({
    owner: repository.owner.login,
    repo: repository.name,
    startDate,
    endDate,
    branch: selectedBranch,
  });

  useEffect(() => {
    if (job?.status === "succeeded" && job.reportId) {
      router.push(`/app/reports/${job.reportId}`);
    } else if (
      job?.status === "failed" &&
      toastedJobId.current !== job.jobId
    ) {
      toastedJobId.current = job.jobId;
      toast.error(job.error?.message ?? "Failed to generate report");
    }
  }, [job, router]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const handleGenerate = async () => {
    if (!startDate || !selectedBranch) return;

    startTransition(async () => {
      const d = new Date();
      const finalEndDate =
        endDate ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const { data, error } = await apiClient.POST("/api/v1/reports", {
        body: {
          data: {
            repository: repository.name,
            gitProvider: "github",
            providerOwner: repository.owner.login,
            providerProjectId: repository.id,
            branch: selectedBranch,
            startDate,
            endDate: finalEndDate,
            customInstructions,
          },
        },
      });

      if (error || !data) {
        toast.error("Failed to generate report");
        return;
      }

      setJobId(data.jobId);
    });
  };

  // A failed job keeps its jobId in state (the toast is guarded), so the
  // button re-enables by excluding the failed status rather than resetting.
  const isGenerating = isPending || (!!jobId && job?.status !== "failed");

  return (
    <Card className="border-0 shadow-sm max-w-2xl mx-auto">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold">Report Configuration</h3>
          <p className="text-xs text-muted-foreground">
            Configure your date range and branch to generate a comprehensive
            report.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <DatePicker
                label={
                  <>
                    Start Date <span className="text-red-500">*</span>
                  </>
                }
                date={startDate ? parseISO(startDate) : undefined}
                onSelect={(date) =>
                  updateParam(
                    "startDate",
                    date ? format(date, "yyyy-MM-dd") : "",
                  )
                }
                disabled={(date) => date > new Date()}
              />
            </div>

            <div>
              <DatePicker
                label="End Date"
                date={endDate ? parseISO(endDate) : undefined}
                onSelect={(date) =>
                  updateParam("endDate", date ? format(date, "yyyy-MM-dd") : "")
                }
                disabled={(date) =>
                  date > new Date() ||
                  (startDate ? date < new Date(startDate) : false)
                }
              />
              {endDate && isToday(parseISO(endDate)) && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Includes commits up to ~{format(new Date(), "h:mm a")} (current time)
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="max-w-xs">
              <Label htmlFor="branch" className="text-sm font-medium">
                Branch
              </Label>
              <Combobox
                items={branches}
                itemToStringValue={(b: string) => b}
                value={selectedBranch}
                onValueChange={(v: string | null) => v && updateParam("branch", v)}
              >
                <ComboboxInput
                  className="mt-1.5"
                  placeholder="Search branches..."
                  aria-label="Branch"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No branches found.</ComboboxEmpty>
                  <ComboboxList>
                    {(branch: string) => (
                      <ComboboxItem key={branch} value={branch}>
                        {branch}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Model:{" "}
              <span className="font-medium">
                {aiSettings
                  ? `${aiSettings.reportModel} · ${aiSettings.reportProvider}`
                  : "Loading..."}
              </span>{" "}
              (managed in Settings)
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="customInstructions"
                className="text-sm font-medium"
              >
                Custom AI Instructions
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPromptPresetsOpen(true)}
                className="h-7 px-2 text-xs"
              >
                <Bookmark className="h-3.5 w-3.5 mr-1" />
                Presets
              </Button>
            </div>
            <Textarea
              id="customInstructions"
              placeholder="e.g., Focus on infrastructure, Highlight security changes"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-20 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Add specific instructions to guide the AI report generation
            </p>
          </div>
          <PromptPresetsModal
            open={promptPresetsOpen}
            onOpenChange={setPromptPresetsOpen}
            onSelectPrompt={setCustomInstructions}
          />
        </div>

        <CommitsPreviewCard
          startDate={startDate}
          isFetching={commitsFetching}
          hasError={commitsError}
          commitCount={commitCount}
          commits={commits}
        />

        <div className="pt-1 space-y-1.5">
          <Button
            onClick={handleGenerate}
            disabled={!startDate || !selectedBranch || isGenerating}
            size="default"
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
              <>
               
                Generate Report
              </>
            )}
          </Button>

          {job && job.status !== "succeeded" && job.status !== "failed" && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {job.progress ?? "Ingesting repository..."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
