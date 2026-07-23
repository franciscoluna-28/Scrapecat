export type ProcessedCommit = {
  sha: string;
  message: string;
  author: string;
  url?: string;
  date: string;
};

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

export type GitHubRepositoryClientPage = {
  id: number;
  name: string;
  full_name: string;
};

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
  imageAssets: ImageAsset[];
};

export type ExtractedImage = {
  url: string;
  alt: string;
  commitSha: string;
  commitMessage: string;
};
