import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/drizzle/client";
import { reports } from "@/src/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const projectName = searchParams.get("projectName");

    const [projectNames, allReports] = await Promise.all([
      db
        .select({ name: reports.githubRepositoryName })
        .from(reports)
        .groupBy(reports.githubRepositoryName)
        .orderBy(reports.githubRepositoryName),
      db.query.reports.findMany({
        where: projectName
          ? eq(reports.githubRepositoryName, projectName)
          : undefined,
        orderBy: (reports, { desc }) => [desc(reports.updatedAt)],
      }),
    ]);

    return NextResponse.json({
      reports: allReports.map((report) => ({
        id: report.id,
        githubRepositoryName: report.githubRepositoryName,
        githubProjectId: report.githubProjectId,
        startDate: report.startDate,
        endDate: report.endDate,
        branch: report.branch,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      distinctProjects: projectNames.map((r) => r.name),
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
