"use client";

import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { useState, useTransition } from "react";
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
import { VirtualCommitList } from "@/src/_features/reports/components/VirtualCommitList";
import {
  ArrowLeft,
  GitCommit,
  WandSparkles,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/src/shared/api/client";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";

type Props = {
  repositoryName: string;
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
    <ul className="mb-4 list-none space-y-1.5">
      {children}
    </ul>
  ),
  li: ({ children }) => (
    <li className="text-muted-foreground">
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
  repositoryName,
  startDate,
  endDate,
  branch,
  report,
  reportId,
}: Props) {
  const [isReplying, startReplyTransition] = useTransition();
  const [replyText, setReplyText] = useState("");
  const [currentReport, setCurrentReport] = useState(report);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refineOpen, setRefineOpen] = useState(false);

  const handleBack = () => window.history.back();

  const handleSendReply = async () => {
    if (!replyText.trim() || !reportId) return;

    startReplyTransition(async () => {
      try {
        const { data, error } = await apiClient.POST("/api/v1/reports/{id}/replies", {
          params: { path: { id: reportId! } },
          body: { reply: replyText },
        });

        if (error || !data) {
          toast.error("Failed to refine report");
          return;
        }

        setCurrentReport(data.report);
        setReplyText("");
        setRefineOpen(false);
        toast.success("Report refined successfully");
      } catch {
        toast.error("Failed to refine report");
      }
    });
  };



  if (!repositoryName) {
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
        <div
          className={`${
            sidebarOpen ? "w-96" : "w-0"
          } shrink-0 border-r bg-muted/30 flex flex-col transition-all duration-200 overflow-hidden`}
        >
          <div className="p-4 border-b flex items-center min-w-0">
            <a href="/new" className="flex items-center gap-2 rounded-lg hover:bg-muted/50 px-1.5 py-1 transition-colors">
              <div className="flex aspect-square size-7 items-center justify-center rounded-lg">
                <Image src={LogoImage} alt="Scrapecat Logo" width={24} height={24} className="size-6" />
              </div>
              <div className="grid text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sm">Scrapecat</span>
                <span className="truncate text-[10px] text-muted-foreground leading-tight">Reports</span>
              </div>
            </a>
          </div>

          <div className="p-4 space-y-4 border-b min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Repository</Label>
              <p className="text-sm font-semibold truncate">{repositoryName}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Badge className="text-xs border-primary/30 bg-primary/10 text-primary">
                {branch}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm">
                  {format(parseISO(startDate), "MMM d, yyyy")} — {endDate ? format(parseISO(endDate), "MMM d, yyyy") : "Present"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-w-0">
            <VirtualCommitList reportId={reportId ?? ""} />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
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
                <h1 className="text-base font-bold tracking-tight">
                  Intelligence Report
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {reportId && (
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
                      .replace(/^-\s*\n+(?=[^\s-])/gm, "- ")}
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
