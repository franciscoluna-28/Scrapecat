"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/src/components/ui/card";
import { ChevronRight, FileText, CalendarDays } from "lucide-react";
import type { ReportSummary } from "@/src/shared/types";

type Props = {
  report: ReportSummary;
};

export function ReportCard({ report }: Props) {
  const createdDate = new Date(report.createdAt);

  return (
    <Link href={`/app/reports/${report.id}`} className="block">
      <Card className="hover:bg-muted/80 bg-muted/40 transition-colors cursor-pointer ring-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/70">
              <FileText className="h-5 w-5 text-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">
                {report.title || report.repositoryName}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{report.branch}</span>
                <span className="flex items-center gap-1">
                  {format(createdDate, "MMM d, yyyy")}
                </span>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground ml-2 shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
