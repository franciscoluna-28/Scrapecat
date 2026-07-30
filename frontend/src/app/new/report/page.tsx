"use client";

import { useSearchParams } from "next/navigation";
import { useReport } from "@/src/_features/reports/services/reports-api";
import type { ProcessedCommit } from "@/src/shared/types";
import type { ImageAsset } from "@/src/shared/types";
import ReportClientPage from "./client-page";

export default function ReportPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");

  const { report, isLoading } = useReport(reportId ?? "");

  if (!reportId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Invalid Report Link</h3>
            <p className="text-muted-foreground mb-4">
              Please generate a report from settings page first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Loading Report...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Error Loading Report</h3>
            <p className="text-muted-foreground mb-4">
              Unable to load the report. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReportClientPage
      commits={(report.sourceCommits || []) as ProcessedCommit[]}
      repository={{
        id: report.githubProjectId,
        name: report.githubRepositoryName,
        full_name: report.githubRepositoryName,
      }}
      startDate={report.startDate}
      endDate={report.endDate}
      branch={report.branch}
      report={report.editableMarkdown}
      reportId={reportId}
      imageAssets={(report.imageAssets || []) as ImageAsset[]}
    />
  );
}
