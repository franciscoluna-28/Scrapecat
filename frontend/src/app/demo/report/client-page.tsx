"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { CopyButton } from "@/src/components/ui/copy-button";
import { CommitCard } from "@/src/components/global/CommitCard";
import {
  ArrowLeft,
  GitCommit,
  Plus,
  WandSparkles,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { ProcessedCommit } from "@/src/shared/lib/utils";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";
import { useDemoClientReportsStore } from "@/src/store/demo-client-reports";

type Props = {
  reportId: string;
};

type ReportViewData = {
  commits: ProcessedCommit[];
  repositoryName: string;
  startDate: string;
  endDate: string;
  branch: string;
  report: string;
  reportId: string;
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
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-foreground/90 mb-3 mt-8">
      {children}
    </h3>
  ),
  br: () => <br />,
  p: ({ children }) => (
    <p className="mb-6 text-muted-foreground leading-relaxed text-base">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="mb-4">{children}</ul>,
  li: ({ children }) => (
    <li className="ml-4 mb-1 text-muted-foreground">
      <span className="text-foreground">- {children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
};

function ReportView({
  data: initial,
  onUpdate,
}: {
  data: ReportViewData;
  onUpdate: (markdown: string) => void;
}) {
  const [isReplying, startReplyTransition] = useTransition();
  const [replyText, setReplyText] = useState("");
  const [currentReport, setCurrentReport] = useState(initial.report);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refineOpen, setRefineOpen] = useState(false);

  const handleBack = () => window.history.back();

  const handleSendReply = async () => {
    if (!replyText.trim() || !initial.reportId) return;

    startReplyTransition(async () => {
      try {
        const res = await fetch(
          `/api/demo/reports/${initial.reportId}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply: replyText }),
          },
        );

        if (!res.ok) {
          toast.error("Failed to refine report");
          return;
        }

        const data = await res.json();
        setCurrentReport(data.report);
        onUpdate(data.report);
        setReplyText("");
        setRefineOpen(false);
        toast.success("Report refined successfully");
      } catch {
        toast.error("Failed to refine report");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        <div
          className={`${
            sidebarOpen ? "w-80" : "w-0"
          } shrink-0 border-r bg-muted/30 flex flex-col transition-all duration-200 overflow-hidden`}
        >
          <div className="p-4 border-b flex items-center justify-between min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href="/demo">
                <Plus className="h-4 w-4 mr-1" /> New Report
              </Link>
            </Button>
          </div>

          <div className="p-4 space-y-4 border-b min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Repository
              </Label>
              <p className="text-sm font-semibold truncate">
                {initial.repositoryName}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Badge className="text-xs border-primary/30 bg-primary/10 text-primary">
                {initial.branch}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm">
                  {format(parseISO(initial.startDate), "MMM d, yyyy")} —{" "}
                  {initial.endDate
                    ? format(parseISO(initial.endDate), "MMM d, yyyy")
                    : "Present"}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Commits</Label>
              <Badge variant="secondary" className="text-xs">
                {initial.commits.length} audited
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-w-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <h3 className="text-xs font-semibold text-muted-foreground mb-4">
                  Source Commits
                </h3>
                <CommitCard commits={initial.commits} />
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-foreground"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Intelligence Report
                </h1>
                <p className="text-xs text-muted-foreground">
                  Generated on {new Date().toLocaleDateString("en-US")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {initial.reportId && (
                <Dialog open={refineOpen} onOpenChange={setRefineOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <WandSparkles className="h-4 w-4 mr-2" />
                      Refine
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Refine Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Send follow-up instructions to refine the generated
                        report.
                      </p>
                      <Textarea
                        placeholder="e.g., Make it more technical, add more detail to infrastructure changes..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-30 text-sm"
                      />
                      <Button
                        onClick={handleSendReply}
                        disabled={isReplying || !replyText.trim()}
                        size="default"
                        className="w-full"
                      >
                        {isReplying ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <WandSparkles className="h-4 w-4 mr-2" />
                        )}
                        Refine
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <CopyButton text={currentReport} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-background/50 rounded-xl p-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                <div className="max-w-none select-text space-y-4">
                  <ReactMarkdown components={markdownComponents}>
                    {currentReport
                      .replace(/•\s*/g, "- ")
                      .replace(/^-\s*\n(?=[^\s-])/gm, "- ")}
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

export default function DemoReportClientPage({ reportId }: Props) {
  const [viewData, setViewData] = useState<ReportViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { reports, updateReport } = useDemoClientReportsStore();
  const [localRefined, setLocalRefined] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const clientReport = reports.find((r) => r.id === reportId);

    if (clientReport) {
      const displayReport = localRefined ?? clientReport.editableMarkdown;
      setViewData({
        commits: clientReport.commits || [],
        repositoryName: clientReport.githubRepositoryName,
        startDate: clientReport.startDate,
        endDate: clientReport.endDate,
        branch: clientReport.branch,
        report: displayReport,
        reportId: clientReport.id,
      });
      setLoading(false);
      return;
    }

    fetch(`/api/demo/reports/${reportId}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        setViewData({
          commits: data.sourceCommits || [],
          repositoryName: data.githubRepositoryName,
          startDate: data.startDate,
          endDate: data.endDate,
          branch: data.branch,
          report: data.editableMarkdown || data.originalMarkdown,
          reportId: data.id,
        });
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [reportId, reports, localRefined]);

  const handleUpdate = (markdown: string) => {
    updateReport(reportId, { editableMarkdown: markdown });
    setLocalRefined(markdown);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !viewData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12 space-y-4">
            <GitCommit className="h-12 w-12 text-muted/50 mx-auto" />
            <h3 className="text-lg font-medium">Report Not Found</h3>
            <p className="text-muted-foreground mb-4">
              This report could not be found. Please generate a new report.
            </p>
            <Button variant="outline" asChild>
              <Link href="/demo">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Demo
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <ReportView data={viewData} onUpdate={handleUpdate} />;
}
