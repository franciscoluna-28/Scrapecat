import { NextRequest, NextResponse } from "next/server";
import { getReport, updateReport } from "@/src/store/demo-reports-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const report = getReport(id);

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
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      githubProjectId: report.githubProjectId,
      githubRepositoryName: report.githubRepositoryName,
      sourceCommits: report.sourceCommits || [],
      sourceCommitsUpdatedAt: report.sourceCommitsUpdatedAt?.toISOString() || null,
      imageAssets: [],
    });
  } catch (error) {
    console.error("[demo] Error fetching report:", error);
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

    const updated = updateReport(id, { editableMarkdown });

    if (!updated) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = getReport(id);

    return NextResponse.json({
      id: report!.id,
      editableMarkdown: report!.editableMarkdown,
      updatedAt: report!.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[demo] Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 },
    );
  }
}
