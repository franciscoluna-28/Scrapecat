import { Type } from "@sinclair/typebox";
import type { FastifySchema } from "fastify";
import { ErrorResponse, GitProviderSchema } from "@/shared/typebox";

export const IngestionRunJobTypeSchema = Type.Union([
  Type.Literal("ingest-branch"),
  Type.Literal("reindex-embeddings"),
]);

export const IngestionRunStatusSchema = Type.Union([
  Type.Literal("succeeded"),
  Type.Literal("failed"),
]);

export const IngestionRunsQuery = Type.Object({
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 50, default: 8 }),
  ),
  windowDays: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 90, default: 7 }),
  ),
  projectId: Type.Optional(Type.String({ format: "uuid" })),
  jobType: Type.Optional(IngestionRunJobTypeSchema),
});

export const IngestionRunSummaryResponse = Type.Object({
  windowDays: Type.Integer(),
  runs: Type.Integer(),
  failedRuns: Type.Integer(),
  commitsProcessed: Type.Integer(),
  embeddingsProcessed: Type.Integer(),
  avgDurationMs: Type.Union([Type.Integer(), Type.Null()]),
  embeddingInputTokens: Type.Union([Type.Integer(), Type.Null()]),
  embeddingOutputTokens: Type.Union([Type.Integer(), Type.Null()]),
});

export const IngestionRunResponse = Type.Object({
  id: Type.String(),
  jobType: IngestionRunJobTypeSchema,
  status: IngestionRunStatusSchema,
  projectId: Type.Union([Type.String(), Type.Null()]),
  branch: Type.Union([Type.String(), Type.Null()]),
  repositoryName: Type.Union([Type.String(), Type.Null()]),
  providerOwner: Type.Union([Type.String(), Type.Null()]),
  gitProvider: Type.Union([GitProviderSchema, Type.Null()]),
  startedAt: Type.String({ format: "date-time" }),
  finishedAt: Type.String({ format: "date-time" }),
  durationMs: Type.Integer(),
  gitMs: Type.Union([Type.Integer(), Type.Null()]),
  dbMs: Type.Union([Type.Integer(), Type.Null()]),
  embeddingMs: Type.Union([Type.Integer(), Type.Null()]),
  commitsFound: Type.Union([Type.Integer(), Type.Null()]),
  commitsWritten: Type.Union([Type.Integer(), Type.Null()]),
  commitsEmbedded: Type.Union([Type.Integer(), Type.Null()]),
  embeddingProvider: Type.Union([Type.String(), Type.Null()]),
  embeddingModel: Type.Union([Type.String(), Type.Null()]),
  embeddingInputTokens: Type.Union([Type.Integer(), Type.Null()]),
  embeddingOutputTokens: Type.Union([Type.Integer(), Type.Null()]),
  errorCode: Type.Union([Type.String(), Type.Null()]),
  errorMessage: Type.Union([Type.String(), Type.Null()]),
});

export const IngestionRunsResponse = Type.Object({
  summary: IngestionRunSummaryResponse,
  runs: Type.Array(IngestionRunResponse),
});

export const ListIngestionRunsRoute = {
  description:
    "List recent ingestion runs and a windowed summary (runs, commits, embedding input/output tokens)",
  tags: ["telemetry"],
  querystring: IngestionRunsQuery,
  response: {
    200: IngestionRunsResponse,
    400: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;
