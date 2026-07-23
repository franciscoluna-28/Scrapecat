import DemoReportClientPage from "./client-page";

interface ReportPageProps {
  searchParams: Promise<{
    reportId?: string;
  }>;
}

export default async function DemoReportPage({
  searchParams,
}: ReportPageProps) {
  const { reportId } = await searchParams;
  return <DemoReportClientPage reportId={reportId || ""} />;
}
