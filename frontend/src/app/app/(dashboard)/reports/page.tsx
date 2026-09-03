"use client";

import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { FileText, CalendarDays } from "lucide-react";
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

const PRESETS = [
  { label: "All time", value: "all", days: null },
  { label: "Last 7 days", value: "7d", days: 7 },
  { label: "Last 30 days", value: "30d", days: 30 },
  { label: "Last 90 days", value: "90d", days: 90 },
] as const;

export default function ReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [preset, setPreset] = useState("all");

  const { startDate, endDate } = useMemo(() => {
    const p = PRESETS.find((p) => p.value === preset);
    if (p?.days) {
      return {
        startDate: format(subDays(new Date(), p.days), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [preset]);

  const { reports, isFetching: isFetchingReports, hasError: hasReportsError } = useReports(
    selectedProjectId,
    startDate,
    endDate,
  );
  const { projects } = useProjects();

  return (
    <SectionLayout>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {projects.length > 0 && (
          <Select
            value={selectedProjectId ?? "all"}
            onValueChange={(value) =>
              setSelectedProjectId(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-44">
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
        )}

        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
