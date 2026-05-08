"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  ArrowLeft,
  GitCommit,
  Calendar,
  GitBranch,
  Copy,
  FileText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { GitHubRepositoryClientPage } from "@/src/shared/types";
import { ProcessedCommit } from "@/src/shared/lib/utils";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";

type Props = {
  commits: ProcessedCommit[];
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
      console.error(err);
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/new">
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Intelligence Report
          </h1>
          <p className="text-muted-foreground">
            Automated technical audit generated on{" "}
            {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <Label className="text-xs text-muted-foreground">
                  Repository
                </Label>
                <p className="text-sm font-medium truncate leading-tight mt-1">
                  {repository.name}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs text-muted-foreground">
                  Analysis Period
                </Label>
                <p className="text-sm font-medium leading-tight mt-1">
                  {startDate}{" "}
                  <span className="text-muted-foreground mx-1">—</span>{" "}
                  {endDate || "Now"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col items-start">
                <Label className="text-xs text-muted-foreground">
                  Active Branch
                </Label>
                <div className="mt-1">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs px-2 py-0"
                  >
                    {branch}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-none ring-1 ring-border/50 bg-muted/40">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-muted p-2 rounded-md">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Analysis Results</h2>
                <p className="text-xs text-muted-foreground">
                  {commits.length} commits audited
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
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="min-h-[500px]">
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
