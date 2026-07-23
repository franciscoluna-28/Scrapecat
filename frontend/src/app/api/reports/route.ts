import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/drizzle/client";
import { reports } from "@/src/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const projectIdParam = searchParams.get("projectId");
    const projectId = projectIdParam ? Number(projectIdParam) : undefined;

    const [distinctProjects, allReports] = await Promise.all([
      db
        .select({
          id: reports.githubProjectId,
          name: reports.githubRepositoryName,
        })
        .from(reports)
        .groupBy(reports.githubProjectId)
        .orderBy(reports.githubRepositoryName),
      db.query.reports.findMany({
        where: projectId
          ? eq(reports.githubProjectId, projectId)
          : undefined,
        orderBy: (r, { desc }) => [desc(r.updatedAt)],
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
      distinctProjects,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
