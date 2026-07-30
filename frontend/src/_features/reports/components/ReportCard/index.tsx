"use client";

import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { FileText, ChevronRight } from "lucide-react";

interface Report {
  id: string;
  githubRepositoryName: string;
  githubProjectId: number;
  startDate: string;
  endDate: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
}

type Props = {
  report: Report;
};

export function ReportCard({ report }: Props) {
  return (
    <Link href={`/new/report?reportId=${report.id}`} className="block">
      <Card className="hover:bg-muted/80 bg-muted/40 transition-colors cursor-pointer ring-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold truncate">{report.githubRepositoryName}</h3>
                <Badge variant="secondary" className="text-xs">
                  {report.branch}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created: {new Date(report.createdAt).toLocaleDateString()}</span>
                <span>Edited: {new Date(report.updatedAt).toLocaleDateString()}</span>
              </div>

            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
