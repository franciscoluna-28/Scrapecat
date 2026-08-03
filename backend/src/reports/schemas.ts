import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const reportInputSchema = z.object({
  repository: z.string(),
  githubOwner: z.string(),
  githubProjectId: z.number(),
  branch: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  customInstructions: z.string().optional(),
  model: z.string().optional(),
  provider: z
    .enum(["openrouter", "deepseek", "openai"])
    .optional(),
});

export const reportInputBodySchema = z.object({
  data: reportInputSchema,
});

export const listReportsQuerySchema = z.object({
  projectId: z.string().optional(),
});

export const reportIdParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

export const updateReportBodySchema = z.object({
  editableMarkdown: z.string().min(1, "editableMarkdown is required"),
});

export const replyBodySchema = z.object({
  reply: z.string().min(1, "reply is required"),
  model: z.string().optional(),
  provider: z.string().optional(),
});

const ReportDataInput = Type.Object({
  repository: Type.String(),
  githubOwner: Type.String(),
  githubProjectId: Type.Integer(),
  branch: Type.String(),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
  customInstructions: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  provider: Type.Optional(Type.String()),
});

export const ReportInputBody = Type.Object({
  data: ReportDataInput,
});

export const ReportCreatedResponse = Type.Object({
  reportId: Type.String(),
  projectId: Type.String(),
});

export const ReportFallbackResponse = Type.Object({
  report: Type.String(),
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
  editableMarkdown: Type.String(),
  startDate: Type.String(),
  endDate: Type.String(),
  branch: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
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
  provider: Type.Optional(Type.String()),
});

export const ReportReplyResponse = Type.Object({
  report: Type.String(),
});
