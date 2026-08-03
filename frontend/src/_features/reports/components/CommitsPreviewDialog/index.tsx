import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Button } from "@/src/components/ui/button";
import { GitCommit } from "lucide-react";
import { ProcessedCommit } from "@/src/shared/types";
import { CommitCard } from "@/src/_features/reports/components/CommitCard";

type CommitPreviewProps = {
  commits: ProcessedCommit[];
  commitCount: number;
};

export function CommitsPreviewDialog({
  commits,
  commitCount,
}: CommitPreviewProps) {
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
                id: c.sha,
                commitSha: c.sha,
                commitMessage: c.message || "No commit message",
                author: c.author || null,
                committedAt: c.date || new Date().toISOString(),
                diffSummary: "",
              }))}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
