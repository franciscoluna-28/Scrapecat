import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const askBodySchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  question: z.string().min(1, "question is required").max(2000),
  model: z.string().optional(),
  provider: z
    .enum(["openrouter", "deepseek", "openai"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const AskBody = Type.Object({
  projectId: Type.String(),
  question: Type.String(),
  model: Type.Optional(Type.String()),
  provider: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
});

const ChatSource = Type.Object({
  commitSha: Type.String(),
  commitMessage: Type.String(),
  author: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  diffSummary: Type.String(),
  committedAt: Type.String({ format: "date-time" }),
  similarity: Type.Number(),
});

export const AskResponse = Type.Object({
  answer: Type.String(),
  sources: Type.Array(ChatSource),
});
