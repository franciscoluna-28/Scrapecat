import { redirect } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { ReportsDashboard } from "@/src/_features/reports/components/ReportsDashboard";
import { IS_DEMO } from "@/src/shared/constants";

export default function DashboardPage() {
  if (IS_DEMO) {
    redirect("/app/chat");
  }

  return (
    <SectionLayout className="max-w-5xl">
      <ReportsDashboard />
    </SectionLayout>
  );
}
