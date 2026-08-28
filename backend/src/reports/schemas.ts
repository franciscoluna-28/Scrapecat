import { Type, type Static } from "@sinclair/typebox";

export const ReportDataInput = Type.Object({
  repository: Type.String(),
  gitProvider: Type.Optional(
    Type.Union([Type.Literal("github"), Type.Literal("gitlab")], { default: "github" }),
  ),
  providerProjectId: Type.String(),
  providerOwner: Type.String(),
  branch: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
  customInstructions: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  provider: Type.Optional(
    Type.Union([Type.Literal("openrouter"), Type.Literal("deepseek"), Type.Literal("openai")]),
  ),
});

export const ReportInputBody = Type.Object({
  data: ReportDataInput,
});

export type CreateReportInput = Static<typeof ReportDataInput>;

export const ReportJobAcceptedResponse = Type.Object({
  jobId: Type.String(),
  status: Type.String(),
});

export const ReportJobStatusResponse = Type.Object({
  jobId: Type.String(),
  status: Type.String(),
  phase: Type.Union([
    Type.Literal("ingestion"),
    Type.Literal("generation"),
    Type.Null(),
  ]),
  commitCount: Type.Integer(),
  progress: Type.Union([Type.String(), Type.Null()]),
  reportId: Type.Union([Type.String(), Type.Null()]),
  projectId: Type.Union([Type.String(), Type.Null()]),
  error: Type.Union([
    Type.Object({
      message: Type.String(),
      status: Type.Integer(),
    }),
    Type.Null(),
  ]),
  createdAt: Type.String({ format: "date-time" }),
  startedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  finishedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const ReportJobParams = Type.Object({
  jobId: Type.String({ format: "uuid" }),
});

export const ReportsListQuery = Type.Object({
  projectId: Type.Optional(Type.String()),
});

const ReportSummary = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  title: Type.String(),
  repositoryName: Type.String(),
  startDate: Type.String(),
  endDate: Type.String(),
  branch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const ReportsListResponse = Type.Object({
  reports: Type.Array(ReportSummary),
});

export const ReportIdParams = Type.Object({
  id: Type.String(),
});

export const ReportGetResponse = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  title: Type.String(),
  repositoryName: Type.String(),
  originalMarkdown: Type.String(),
  startDate: Type.String(),
  endDate: Type.String(),
  branch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const ReportCommitsQuery = Type.Object({
  q: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
});

export const ReportCommitsResponse = Type.Object({
  commits: Type.Array(
    Type.Object({
      id: Type.String(),
      commitSha: Type.String(),
      commitMessage: Type.String(),
      author: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      committedAt: Type.String({ format: "date-time" }),
      metadata: Type.Optional(Type.Any()),
    }),
  ),
  nextCursor: Type.Union([Type.Null(), Type.String()]),
  total: Type.Integer(),
});
