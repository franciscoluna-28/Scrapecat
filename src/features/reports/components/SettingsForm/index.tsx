"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { GitHubRepository } from "@/src/shared/types";
import { Book, Loader2, GitCommit } from "lucide-react";
import { processCommitsForAiReport } from "@/src/shared/lib/utils";
import { APP_CONFIG } from "@/src/shared/constants/app";
import { toast } from "sonner";
import { DatePicker } from "@/src/components/global/DatePicker";
import { Skeleton } from "@/src/components/ui/skeleton";
import { CommitCard } from "@/src/components/global/CommitCard";
import { useCommits } from "@/src/features/reports/services/api";

type Props = {
  repository: GitHubRepository;
  branches: string[];
  selectedBranch: string;
  startDate?: string;
  endDate?: string;
};

type CommitPreviewProps = {
  commits: Array<{
    sha: string;
    commit: {
      message: string;
      author?: {
        name?: string;
        date?: string;
      } | null;
    };
    html_url?: string;
  }>;
  commitCount: number;
};

function CommitsPreview({ commits, commitCount }: CommitPreviewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground px-0"
        >
          <GitCommit className="h-4 w-4 mr-2" />
          {commitCount} {commitCount === 1 ? "commit" : "commits"} found for
          this period
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Source Commits</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {commitCount} commits will be included in the report
          </p>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="p-6">
            <CommitCard
              commits={commits.map((c) => ({
                sha: c.sha,
                message: c.commit.message,
                author: c.commit.author?.name || "Unknown",
                date: c.commit.author?.date
                  ? new Date(c.commit.author.date).toLocaleDateString("en-US")
                  : "Unknown",
                url: c.html_url,
              }))}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

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

  const {
    commits,
    count: commitCount,
    isFetching,
    hasError,
  } = useCommits({
    owner: repository.owner.login,
    repo: repository.name,
    startDate,
    endDate,
    branch: selectedBranch,
  });

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/new/settings?${params.toString()}`);
  };

  const handleGenerate = async () => {
    if (!startDate || commits.length === 0) return;

    startTransition(async () => {
      const d = new Date();
      const finalEndDate =
        endDate ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const reportRes = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            repository: repository.name,
            branch: selectedBranch,
            startDate,
            endDate: finalEndDate,
            commits: processCommitsForAiReport(commits),
            customInstructions,
          },
        }),
      });

      if (!reportRes.ok) {
        toast.error("Failed to generate report");
        return;
      }

      const { reportId } = await reportRes.json();
      router.push(`/new/report?reportId=${reportId}`);
    });
  };

  /**
   * Determines if the form is ready for report generation.
   * Requires: date selected, not loading, no errors, and at least 1 commit.
   */
  const canGenerate = !isFetching && !hasError && startDate && commitCount > 0;

  return (
    <Card className="border-0 shadow-sm max-w-2xl mx-auto">
      <CardContent className="p-8 space-y-8">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Report Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure your date range and branch to generate a comprehensive
            report.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
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

            <div className="space-y-2">
              <DatePicker
                label="End Date (optional)"
                date={endDate ? parseISO(endDate) : undefined}
                onSelect={(date) =>
                  updateParam("endDate", date ? format(date, "yyyy-MM-dd") : "")
                }
                disabled={(date) =>
                  date > new Date() ||
                  (startDate ? date < new Date(startDate) : false)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch" className="text-base font-medium">
              Select Branch
            </Label>
            <Select
              value={selectedBranch}
              onValueChange={(v) => updateParam("branch", v)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="customInstructions"
              className="text-base font-medium"
            >
              Custom AI Instructions
            </Label>
            <Textarea
              id="customInstructions"
              placeholder="e.g., Focus on infrastructure, Highlight security changes"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">
              Add specific instructions to guide the AI report generation
            </p>
          </div>
        </div>

        {startDate && (
          <>
            <Card className="border-none shadow-none">
              <CardContent className="flex items-center gap-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted border">
                  <GitCommit className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex flex-col gap-2 overflow-hidden">
                  <div className="flex flex-col gap-1 w-full">
                    <Label className="text-sm font-semibold whitespace-nowrap">
                      Sync Status
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {isFetching ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <Skeleton className="h-4 w-32 bg-muted" />
                      </div>
                    ) : hasError ? (
                      <span className="text-sm text-muted-foreground">
                        Verification failed. Check connection.
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {commitCount === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            No commits found for this period
                          </span>
                        ) : (
                          <CommitsPreview
                            commits={commits}
                            commitCount={commitCount}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="pt-4 space-y-2">
          <Button
            onClick={handleGenerate}
            disabled={!startDate || isPending || !canGenerate}
            size="lg"
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Book className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Up to {APP_CONFIG.commits.MAX_LIMIT} commits will be analyzed for
            the report
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
