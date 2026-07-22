"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import { Label } from "@/src/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/src/components/global/DatePicker";
import { useDemoClientReportsStore } from "@/src/store/demo-client-reports";
import { useAISettingsStore } from "@/src/store/ai-settings";
import { useModels } from "@/src/shared/services/ai-models";

type Props = {
  owner: string;
  repo: string;
  githubProjectId: number;
  branches: string[];
  selectedBranch: string;
  defaultStartDate: string;
  defaultEndDate?: string;
};

export function DemoForm({
  owner,
  repo,
  githubProjectId,
  branches,
  selectedBranch,
  defaultStartDate,
  defaultEndDate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [branch, setBranch] = useState(selectedBranch);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate || "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const addReport = useDemoClientReportsStore((s) => s.addReport);
  const selectedModel = useAISettingsStore((s) => s.selectedModel);
  const setSelectedModel = useAISettingsStore((s) => s.setSelectedModel);
  const { models: availableModels, isLoading: modelsLoading } = useModels();
  const modelMap = Object.fromEntries(availableModels.map((m) => [m.id, m]));

  const handleGenerate = async () => {
    if (!startDate) return;

    startTransition(async () => {
      const d = new Date();
      const finalEndDate =
        endDate ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const commitsRes = await fetch(
        `/api/commits?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&startDate=${startDate}&endDate=${finalEndDate}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}&limit=100`,
      );

      if (!commitsRes.ok) {
        toast.error("Failed to fetch commits");
        return;
      }

      const { commits } = await commitsRes.json();

      if (!commits || commits.length === 0) {
        toast.error("No commits found in the selected date range");
        return;
      }

      const processedCommits = commits.map((c: any) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name || "Unknown",
        url: c.html_url,
        date: c.commit.author?.date
          ? new Date(c.commit.author.date).toLocaleDateString("en-US")
          : "Unknown",
      }));

      const reportRes = await fetch("/api/demo/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            repository: repo,
            githubOwner: owner,
            githubProjectId,
            branch,
            startDate,
            endDate: finalEndDate,
            commits: processedCommits,
            customInstructions,
            quickMode: true,
            model: selectedModel,
          },
        }),
      });

      if (!reportRes.ok) {
        toast.error("Failed to generate report");
        return;
      }

      const { reportId, report } = await reportRes.json();

      addReport({
        id: reportId,
        githubProjectId,
        githubRepositoryName: `${owner}/${repo}`,
        originalMarkdown: report,
        editableMarkdown: report,
        startDate,
        endDate: finalEndDate,
        branch,
        commits: processedCommits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      router.push(`/demo/report?reportId=${reportId}`);
    });
  };

  const disabled = !startDate || isPending;

  return (
    <Card className="border-0 shadow-sm max-w-2xl mx-auto">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold">Report Configuration</h3>
          <p className="text-xs text-muted-foreground">
            Configure your date range and branch to generate a report.
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
                  setStartDate(date ? format(date, "yyyy-MM-dd") : "")
                }
                disabled={(date) => date > new Date() || disabled}
              />
            </div>
            <div>
              <DatePicker
                label="End Date (optional)"
                date={endDate ? parseISO(endDate) : undefined}
                onSelect={(date) =>
                  setEndDate(date ? format(date, "yyyy-MM-dd") : "")
                }
                disabled={(date) =>
                  disabled ||
                  date > new Date() ||
                  (startDate ? date < new Date(startDate) : false)
                }
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="max-w-xs">
              <Label htmlFor="branch" className="text-sm font-medium">
                Branch
              </Label>
              <Select value={branch} onValueChange={setBranch} disabled={disabled}>
                <SelectTrigger className="mt-1.5">
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
          </div>

          <div className="border-t pt-3">
            <div className="max-w-xs">
              <Label htmlFor="model" className="text-sm font-medium">
                AI Model
              </Label>
              <div className="mt-1.5">
                <Combobox
                  items={availableModels.map((m) => m.id)}
                  itemToStringValue={(id) => modelMap[id]?.name || id}
                  value={selectedModel}
                  onValueChange={(v) => setSelectedModel(v || "google/gemma-4-26b-a4b-it:free")}
                  disabled={modelsLoading || disabled || !mounted}
                >
                  <ComboboxInput
                    placeholder={modelsLoading ? "Loading models..." : "Search models..."}
                    showClear={mounted}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No models found.</ComboboxEmpty>
                    <ComboboxList>
                      {(modelId) => (
                        <ComboboxItem key={modelId} value={modelId}>
                          {modelMap[modelId]?.name} {modelMap[modelId]?.free ? "(Free)" : ""}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="customInstructions"
              className="text-sm font-medium"
            >
              Custom AI Instructions
            </Label>
            <Textarea
              id="customInstructions"
              placeholder="e.g., Focus on infrastructure, Highlight security changes"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-20"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Add specific instructions to guide the AI report generation
            </p>
          </div>
        </div>

        <div className="pt-1 space-y-1.5">
          <Button
            onClick={handleGenerate}
            disabled={disabled}
            size="default"
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Loader2 className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
