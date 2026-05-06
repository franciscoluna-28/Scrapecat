import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface ReportData {
  id: string;
  originalMarkdown: string;
  editableMarkdown: string;
  startDate: string;
  endDate: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date;
  githubProjectId: number;
  githubRepositoryName: string;
}

export async function getReportById(id: string): Promise<ReportData | null> {
  try {
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id)
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
    console.error('Error fetching report:', error);
    return null;
  }
}

export async function updateReportEditable(id: string, editableMarkdown: string): Promise<boolean> {
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
    console.error('Error updating report:', error);
    return false;
  }
}
