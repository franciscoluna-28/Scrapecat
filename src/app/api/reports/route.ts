import { NextResponse } from "next/server";
import { db } from "@/src/drizzle/client";

export async function GET() {
  try {
    const allReports = await db.query.reports.findMany({
      orderBy: (reports, { desc }) => [desc(reports.updatedAt)],
    });

    return NextResponse.json(
      allReports.map((report) => ({
        id: report.id,
        githubRepositoryName: report.githubRepositoryName,
        githubProjectId: report.githubProjectId,
        startDate: report.startDate,
        endDate: report.endDate,
        branch: report.branch,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
