import { ProcessedCommit } from "../shared/lib/utils";

export type DemoReport = {
  id: string;
  githubProjectId: number;
  githubRepositoryName: string;
  originalMarkdown: string;
  editableMarkdown: string;
  startDate: string;
  endDate: string;
  branch: string;
  sourceCommits: ProcessedCommit[];
  sourceCommitsUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customInstructions: string | null;
};

const reports = new Map<string, DemoReport>();

export function createReport(data: Omit<DemoReport, "createdAt" | "updatedAt">): DemoReport {
  const now = new Date();
  const report: DemoReport = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  reports.set(report.id, report);
  return report;
}

export function getReport(id: string): DemoReport | null {
  return reports.get(id) ?? null;
}

export function getAllReports(): DemoReport[] {
  return Array.from(reports.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

export function getDistinctProjects(): { id: number; name: string }[] {
  const seen = new Map<number, string>();
  for (const report of reports.values()) {
    if (!seen.has(report.githubProjectId)) {
      seen.set(report.githubProjectId, report.githubRepositoryName);
    }
  }
  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function updateReport(
  id: string,
  data: Partial<Pick<DemoReport, "editableMarkdown" | "updatedAt">>,
): boolean {
  const report = reports.get(id);
  if (!report) return false;
  reports.set(id, { ...report, ...data, updatedAt: new Date() });
  return true;
}

export function getReportsByProject(projectId?: number): DemoReport[] {
  if (projectId === undefined) return getAllReports();
  return getAllReports().filter((r) => r.githubProjectId === projectId);
}
