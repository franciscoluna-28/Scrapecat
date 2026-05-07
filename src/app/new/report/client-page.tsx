"use client";

import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  ArrowLeft,
  GitCommit,
  Calendar,
  GitBranch,
  Copy,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { GitHubCommit, GitHubRepositoryClientPage } from "@/src/shared/types";

type Props = {
  commits: GitHubCommit[];
  repository: GitHubRepositoryClientPage;
  startDate: string;
  endDate: string;
  branch: string;
  report: string;
  reportId?: string;
};

export default function ReportClientPage({
  repository,
  commits,
  startDate,
  endDate,
  branch,
  report,
}: Props) {
  const handleBack = () => window.history.back();

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Report copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy report");
    }
  };

  const renderMarkdown = (content: string) => {
    return content
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-2xl font-bold tracking-tight mb-6 text-foreground">$1</h1>',
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-lg font-semibold mt-8 mb-4 border-b pb-2 text-foreground/90">$1</h2>',
      )
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-base font-semibold mt-6 mb-2 text-foreground/80">$1</h3>',
      )
      .replace(
        /\*\*(.*)\*\*/gim,
        '<strong class="font-bold text-foreground">$1</strong>',
      )
      .replace(
        /^- (.*$)/gim,
        '<li class="ml-4 mb-1 text-muted-foreground"><span class="text-foreground">$1</span></li>',
      )
      .replace(
        /\n\n/gim,
        '</p><p class="mb-4 text-muted-foreground leading-relaxed">',
      )
      .replace(/\n/gim, "<br/>");
  };

  if (!repository) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <GitCommit className="h-12 w-12 text-muted/50 mx-auto" />
          <h3 className="text-xl font-semibold">No session data found</h3>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Configuration
          </Button>
        </div>
        <div className="space-y-2 mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight">
            Intelligence Report
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Automated technical audit for{" "}
            <span className="text-foreground font-medium underline underline-offset-4">
              {repository.name}
            </span>
            .
          </p>
        </div>

        <Card className="border-none shadow-none ring-1 ring-border/50 bg-muted/40!">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Analysis Metadata</h2>
                  <p className="text-xs text-muted-foreground">
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMarkdown}
                className="font-bold h-9 px-4"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Markdown
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 px-2 rounded-lg bg-background/50 border border-border/40">
              <div className="flex items-start gap-3">
                <GitBranch className="h-4 w-4 mt-1 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Branch Context
                  </p>
                  <p className="text-sm font-mono font-medium">{branch}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-1 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Analysis Period
                  </p>
                  <p className="text-sm font-medium">
                    {startDate} — {endDate || "Now"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GitCommit className="h-4 w-4 mt-1 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Source Strength
                  </p>
                  <p className="text-sm font-medium">
                    {commits.length} commits audited
                  </p>
                </div>
              </div>
            </div>

            {/* Markdown Report Body */}
            <div className="pt-4 min-h-[500px]">
              <div className="bg-background/50 rounded-xl p-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                <article className="prose prose-neutral dark:prose-invert max-w-none">
                  <div
                    className="report-content select-text"
                    dangerouslySetInnerHTML={{
                      __html: `<p class="mb-4 text-muted-foreground leading-relaxed">${renderMarkdown(report)}</p>`,
                    }}
                  />
                </article>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
