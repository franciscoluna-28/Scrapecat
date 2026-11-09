"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import { CommitCitationCard } from "@/src/_features/chat/components/CommitCitationCard";
import { cn } from "@/src/shared/lib/utils";
import type { ReportDetail } from "@/src/_features/reports/services/reports-api";

type Props = {
  commits: ReportDetail["sourceCommits"];
};

export function SourceCommits({ commits }: Props) {
  const [open, setOpen] = useState(false);

  if (commits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No commits were used for this report.
      </p>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex cursor-pointer items-center justify-between rounded-md py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Sources used ({commits.length}{" "}
            {commits.length === 1 ? "commit" : "commits"})
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-2">
        {commits.map((commit) => (
          <CommitCitationCard key={commit.commitSha} citation={commit} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
