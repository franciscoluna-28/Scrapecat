import { Type } from "@sinclair/typebox";

export const ErrorResponse = Type.Object({ error: Type.String() });

export const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
});

export const CommitsQuery = Type.Object({
  owner: Type.String(),
  repo: Type.String(),
  limit: Type.Optional(Type.String({ default: "100" })),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  branch: Type.Optional(Type.String()),
});

export const CommitsResponse = Type.Object({
  commits: Type.Array(Type.Record(Type.String(), Type.Any())),
});

export const CommitsCountQuery = Type.Object({
  owner: Type.String(),
  repo: Type.String(),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
});

export const CommitsCountResponse = Type.Object({
  count: Type.Integer(),
});

export const RepositoriesQuery = Type.Object({
  type: Type.Optional(Type.String({ default: "all" })),
  sort: Type.Optional(Type.String({ default: "updated" })),
  direction: Type.Optional(Type.String({ default: "desc" })),
  per_page: Type.Optional(Type.String({ default: "10" })),
});

export const RepositoriesResponse = Type.Array(
  Type.Record(Type.String(), Type.Any()),
);

export const BranchesQuery = Type.Object({
  owner: Type.String(),
  repo: Type.String(),
});

export const BranchesResponse = Type.Object({
  branches: Type.Array(Type.String()),
});

export const VerificationOkResponse = Type.Object({
  status: Type.Literal("ok"),
  github: Type.Object({
    login: Type.String(),
    rateLimitRemaining: Type.Integer(),
  }),
});

export const VerificationErrorResponse = Type.Object({
  status: Type.Literal("error"),
  message: Type.String(),
});

export const ModelsResponse = Type.Object({
  models: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      free: Type.Boolean(),
      description: Type.String(),
    }),
  ),
});

const CommitInput = Type.Object({
  sha: Type.String(),
  message: Type.String(),
  author: Type.String(),
  date: Type.String(),
  url: Type.Optional(Type.String()),
});

const ReportDataInput = Type.Object({
  repository: Type.String(),
  githubOwner: Type.String(),
  githubProjectId: Type.Integer(),
  branch: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
  commits: Type.Array(CommitInput),
  customInstructions: Type.Optional(Type.String()),
  quickMode: Type.Optional(Type.Boolean()),
  model: Type.Optional(Type.String()),
});

export const ReportInputBody = Type.Object({
  data: ReportDataInput,
});

export const ReportCreatedResponse = Type.Object({
  reportId: Type.String(),
  report: Type.String(),
});

export const ReportFallbackResponse = Type.Object({
  report: Type.String(),
});

export const ReportsListQuery = Type.Object({
  projectId: Type.Optional(Type.String()),
});

const ReportSummary = Type.Object({
  id: Type.String(),
  githubRepositoryName: Type.String(),
  githubProjectId: Type.Integer(),
  startDate: Type.String(),
  endDate: Type.String(),
  branch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

const DistinctProject = Type.Object({
  id: Type.Integer(),
  name: Type.String(),
});

export const ReportsListResponse = Type.Object({
  reports: Type.Array(ReportSummary),
  distinctProjects: Type.Array(DistinctProject),
});

export const ReportIdParams = Type.Object({
  id: Type.String(),
});

export const ReportGetResponse = Type.Object({
  id: Type.String(),
  originalMarkdown: Type.String(),
  editableMarkdown: Type.String(),
  startDate: Type.String(),
  endDate: Type.String(),
  branch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
  githubProjectId: Type.Integer(),
  githubRepositoryName: Type.String(),
  sourceCommits: Type.Optional(Type.Array(Type.Any())),
  sourceCommitsUpdatedAt: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
  imageAssets: Type.Optional(Type.Array(Type.Any())),
});

export const ReportUpdateBody = Type.Object({
  editableMarkdown: Type.String(),
});

export const ReportUpdateResponse = Type.Object({
  id: Type.String(),
  editableMarkdown: Type.String(),
  updatedAt: Type.String({ format: "date-time" }),
});

export const ReportReplyBody = Type.Object({
  reply: Type.String(),
  model: Type.Optional(Type.String()),
});

export const ReportReplyResponse = Type.Object({
  report: Type.String(),
});
