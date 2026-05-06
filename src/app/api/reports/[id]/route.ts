import { NextRequest, NextResponse } from "next/server";
import { reports } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { db } from "@/src/drizzle/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: report.id,
      originalMarkdown: report.originalMarkdown,
      editableMarkdown: report.editableMarkdown,
      startDate: report.startDate,
      endDate: report.endDate,
      branch: report.branch,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      githubProjectId: report.githubProjectId,
      githubRepositoryName: report.githubRepositoryName,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { editableMarkdown } = await request.json();

    if (!editableMarkdown) {
      return NextResponse.json(
        { error: "editableMarkdown is required" },
        { status: 400 },
      );
    }

    const updatedReport = await db
      .update(reports)
      .set({
        editableMarkdown,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (updatedReport.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedReport[0].id,
      editableMarkdown: updatedReport[0].editableMarkdown,
      updatedAt: updatedReport[0].updatedAt,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 },
    );
  }
}
