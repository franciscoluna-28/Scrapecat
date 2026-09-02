"use client";

import { useState } from "react";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { FileText } from "lucide-react";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useReports } from "@/src/_features/reports/services/reports-api";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { ReportCard } from "@/src/_features/reports/components/ReportCard";

export default function ReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const { reports, isFetching: isFetchingReports, hasError: hasReportsError } = useReports(selectedProjectId);
  const { projects } = useProjects();

  return (
    <SectionLayout>
      {projects.length > 0 && (
        <div className="flex justify-center mb-4">
          <Select
            value={selectedProjectId ?? "all"}
            onValueChange={(value) =>
              setSelectedProjectId(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.repositoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <div className="p-6 space-y-2">
              {isFetchingReports ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-medium mb-2">Loading reports...</h3>
                </div>
              ) : hasReportsError ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Failed to load reports</h3>
                  <p className="text-muted-foreground">Unable to fetch reports from the database.</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No reports found</h3>
                  <p className="text-muted-foreground">Open a project in chat and use the "Generate report" button to create one.</p>
                </div>
              ) : (
                reports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </SectionLayout>
  );
}
