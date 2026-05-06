import { ReportDataOutput } from "@/src/features/reports/types";
import { getReportById } from "../../../features/reports/server/reports";
import ReportClientPage from "./client-page";

interface ReportPageProps {
  searchParams: Promise<{ 
    reportId?: string;
  }>;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { reportId } = await searchParams;

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

  let report: ReportDataOutput | null;

  try {
    report = await getReportById(reportId);

    if (!report) {
      throw new Error("Failed to fetch report");
    }
    
  } catch (error) {
    console.error("Failed to fetch report:", error);
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
      commits={[]}
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
    />
  );
}
