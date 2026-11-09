import { Type } from "@sinclair/typebox";
import { GitProviderSchema } from "@/shared/typebox";
import {
  DEFAULT_CADENCE,
  DEFAULT_DAY_OF_WEEK,
  DEFAULT_HOUR,
  DEFAULT_TIMEZONE,
  REPORT_CADENCES,
  REPORT_STATUSES,
} from "@/reports/types";

export const ReportCadenceSchema = Type.Union(
  REPORT_CADENCES.map((cadence) => Type.Literal(cadence)),
);

export const ReportStatusSchema = Type.Union(
  REPORT_STATUSES.map((status) => Type.Literal(status)),
);

export const ReportCitationSchema = Type.Object({
  commitSha: Type.String(),
  commitMessage: Type.String(),
  author: Type.Union([Type.String(), Type.Null()]),
  committedAt: Type.String({ format: "date-time" }),
  filesChanged: Type.Array(Type.String()),
  commitUrl: Type.Union([Type.String(), Type.Null()]),
});

export const ReportScheduleIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const CreateReportScheduleBody = Type.Object({
  projectId: Type.String({ format: "uuid" }),
  branch: Type.String({ minLength: 1, maxLength: 255 }),
  cadence: Type.Optional(
    Type.Union(
      REPORT_CADENCES.map((cadence) => Type.Literal(cadence)),
      { default: DEFAULT_CADENCE },
    ),
  ),
  dayOfWeek: Type.Optional(
    Type.Integer({
      minimum: 0,
      maximum: 6,
      default: DEFAULT_DAY_OF_WEEK,
    }),
  ),
  hour: Type.Optional(
    Type.Integer({
      minimum: 0,
      maximum: 23,
      default: DEFAULT_HOUR,
    }),
  ),
  timezone: Type.Optional(
    Type.String({ minLength: 1, default: DEFAULT_TIMEZONE }),
  ),
  enabled: Type.Optional(Type.Boolean({ default: true })),
});

export const UpdateReportScheduleBody = Type.Object({
  cadence: Type.Optional(ReportCadenceSchema),
  dayOfWeek: Type.Optional(Type.Integer({ minimum: 0, maximum: 6 })),
  hour: Type.Optional(Type.Integer({ minimum: 0, maximum: 23 })),
  timezone: Type.Optional(Type.String({ minLength: 1 })),
  enabled: Type.Optional(Type.Boolean()),
});

export const ReportScheduleResponse = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  branch: Type.String(),
  cadence: ReportCadenceSchema,
  dayOfWeek: Type.Integer(),
  hour: Type.Integer(),
  timezone: Type.String(),
  enabled: Type.Boolean(),
  nextRunAt: Type.String({ format: "date-time" }),
  lastRunAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  lastSuccessAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  lastStatus: ReportStatusSchema,
  lastError: Type.Union([Type.String(), Type.Null()]),
  repositoryName: Type.String(),
  providerOwner: Type.String(),
  gitProvider: GitProviderSchema,
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const ReportScheduleListResponse = Type.Object({
  schedules: Type.Array(ReportScheduleResponse),
});

export const RunReportScheduleResponse = Type.Object({
  scheduleId: Type.String(),
  status: ReportStatusSchema,
});

export const ReportsQuery = Type.Object({
  projectId: Type.Optional(Type.String({ format: "uuid" })),
  branch: Type.Optional(Type.String({ minLength: 1 })),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
  ),
});

export const ReportSummaryResponse = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  branch: Type.String(),
  repositoryName: Type.String(),
  providerOwner: Type.String(),
  gitProvider: GitProviderSchema,
  summary: Type.String(),
  provider: Type.Union([Type.String(), Type.Null()]),
  model: Type.Union([Type.String(), Type.Null()]),
  periodStart: Type.String({ format: "date-time" }),
  periodEnd: Type.String({ format: "date-time" }),
  createdAt: Type.String({ format: "date-time" }),
});

export const ReportResponse = Type.Composite([
  ReportSummaryResponse,
  Type.Object({
    sourceCommits: Type.Array(ReportCitationSchema),
  }),
]);

export const ReportsListResponse = Type.Object({
  reports: Type.Array(ReportSummaryResponse),
});

export const ReportIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});
