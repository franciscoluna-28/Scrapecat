import { ProcessedCommit } from "@/src/shared/lib/utils";

/**
 * Report data output type to work with in the application
 * This type is used to pass data between server and client components
 */
export type ReportDataOutput = {
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
  sourceCommits: ProcessedCommit[];
  sourceCommitsUpdatedAt: Date | null;
};


