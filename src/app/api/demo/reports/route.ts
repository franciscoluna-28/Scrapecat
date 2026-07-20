import { NextRequest, NextResponse } from "next/server";
import { getDistinctProjects, getReportsByProject } from "@/src/store/demo-reports-store";

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const projectIdParam = searchParams.get("projectId");
    const projectId = projectIdParam ? Number(projectIdParam) : undefined;

    const distinctProjects = getDistinctProjects();
    const allReports = getReportsByProject(projectId);

    return NextResponse.json({
      reports: allReports.map((report) => ({
        id: report.id,
        githubRepositoryName: report.githubRepositoryName,
        githubProjectId: report.githubProjectId,
        startDate: report.startDate,
        endDate: report.endDate,
        branch: report.branch,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      })),
      distinctProjects,
    });
  } catch (error) {
    console.error("[demo] Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 },
    );
  }
}
