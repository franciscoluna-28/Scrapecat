import { SectionLayout } from "@/src/components/global/SectionLayout";
import { DemoModeNotice } from "@/src/components/global/DemoModeNotice";
import { ReportsDashboard } from "@/src/_features/reports/components/ReportsDashboard";
import { IS_DEMO } from "@/src/shared/constants";

export default function DashboardPage() {
  if (IS_DEMO) {
    return (
      <SectionLayout>
        <DemoModeNotice
          title="Reports"
          description="Scheduled summaries are disabled in demo mode."
        />
      </SectionLayout>
    );
  }

  return (
    <SectionLayout className="max-w-5xl">
      <ReportsDashboard />
    </SectionLayout>
  );
}
