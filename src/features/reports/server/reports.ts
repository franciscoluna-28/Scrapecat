import { db } from "@/src/drizzle/client";
import { reports } from "@/src/drizzle/schema";
import { eq } from "drizzle-orm";
import { ReportDataOutput } from "../types";

export async function getReportById(
  id: string,
): Promise<ReportDataOutput | null> {
  try {
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    });

    if (!report) {
      return null;
    }

    return {
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
    };
  } catch (error) {
    console.error("Error fetching report:", error);
    return null;
  }
}

export async function updateReportEditable(
  id: string,
  editableMarkdown: string,
): Promise<boolean> {
  try {
    const updatedReport = await db
      .update(reports)
      .set({
        editableMarkdown,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    return updatedReport.length > 0;
  } catch (error) {
    console.error("Error updating report:", error);
    return false;
  }
}
