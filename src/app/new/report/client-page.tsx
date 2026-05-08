"use client";

import Link from "next/link";
import { Card, CardContent } from "@/src/components/ui/card";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Button } from "@/src/components/ui/button";
import {
  ArrowLeft,
  GitCommit,
  Copy,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { GitHubRepositoryClientPage } from "@/src/shared/types";
import { ProcessedCommit } from "@/src/shared/lib/utils";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";

type Props = {
  commits: ProcessedCommit[];
  repository: GitHubRepositoryClientPage;
  startDate: string;
  endDate: string;
  branch: string;
  report: string;
  reportId?: string;
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold tracking-tight mb-6 text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-8 mb-4 text-foreground/90">
      {children}
    </h2>
  ),
 h3: ({ children }) => {
  return (
    <h3 className="text-base font-bold text-foreground/90 mb-3 mt-8">
      {children}
    </h3>
  );
},
  br: () => <br />,
  p: ({ children }) => (
  <p className="mb-6 text-muted-foreground leading-relaxed text-base">
    {children}
  </p>
),
  ul: ({ children }) => (
    <ul className="mb-4">
      {children}
    </ul>
  ),
  li: ({ children }) => (
    <li className="ml-4 mb-1 text-muted-foreground">
      <span className="text-foreground">- {children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">
      {children}
    </strong>
  ),
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
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        <div className="w-80 shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/new">
                <Plus className="h-4 w-4 mr-1" /> New Report
              </Link>
            </Button>
          </div>

          <div className="p-4 space-y-3 border-b">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Repository</Label>
              <p className="text-sm font-semibold truncate">{repository.name}</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary" className="font-mono text-xs">
                {branch}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">

                <Label className="text-xs text-muted-foreground">Period</Label>
              </div>
              <p className="text-sm pl-5">
                {startDate} — {endDate || "Now"}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Commits</Label>
              </div>
              <p className="text-sm font-medium">{commits.length} audited</p>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3">
                  Source Commits
                </h3>
                <div className="space-y-2">
                  {commits.map((commit, index) => (
                    <Card key={commit.sha || index} className="overflow-hidden">
                      <CardContent className="p-3">
                        <p className="text-xs font-mono text-muted-foreground mb-1">
                          {commit.sha.slice(0, 7)}
                        </p>
                        <p className="text-xs line-clamp-2 leading-relaxed">
                          {commit.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2">
                          <span className="text-xs text-muted-foreground">
                            {commit.author}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {commit.date}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Intelligence Report
              </h1>
              <p className="text-xs text-muted-foreground">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyMarkdown}
              className="font-bold"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Markdown
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="bg-background/50 rounded-xl p-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                <div className="max-w-none select-text space-y-4">
                  <ReactMarkdown components={markdownComponents}>
                    {report}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
