import { Type } from "@sinclair/typebox";
import type { FastifySchema } from "fastify";
import { ErrorResponse } from "@/shared/typebox";

export const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
});

export const HealthReadyResponse = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
});

export const MetaResponse = Type.Object({
  datasetSource: Type.Literal("database"),
  seedVersion: Type.Null(),
  generatedAt: Type.Null(),
  repos: Type.Array(
    Type.Object({
      providerOwner: Type.String(),
      repositoryName: Type.String(),
      defaultBranch: Type.String(),
      commitCount: Type.Integer(),
    }),
  ),
});

export const HealthRoute = {
  description: "Health check endpoint",
  tags: ["health"],
  response: { 200: HealthResponse },
} satisfies FastifySchema;

export const HealthReadyRoute = {
  description: "Readiness check (verifies the database connection)",
  tags: ["health"],
  response: { 200: HealthReadyResponse, 503: HealthReadyResponse },
} satisfies FastifySchema;

export const MetaRoute = {
  description:
    "Describe the data backing the API (bundled demo dataset vs database)",
  tags: ["meta"],
  response: { 200: MetaResponse, 500: ErrorResponse },
} satisfies FastifySchema;
