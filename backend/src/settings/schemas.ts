import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const aiSettingsInputSchema = z.object({
  reportProvider: z.enum(["openrouter", "deepseek", "openai"]),
  reportModel: z.string().min(1, "Report model is required"),
  embeddingProvider: z.enum(["openrouter"]),
  embeddingModel: z.string().min(1, "Embedding model is required"),
});

export type AISettingsInput = z.infer<typeof aiSettingsInputSchema>;

const AiSettingsResponse = Type.Object({
  reportProvider: Type.String(),
  reportModel: Type.String(),
  embeddingProvider: Type.String(),
  embeddingModel: Type.String(),
});

export const AISettingsBody = Type.Object({
  reportProvider: Type.String(),
  reportModel: Type.String(),
  embeddingProvider: Type.String(),
  embeddingModel: Type.String(),
});

export const AISettingsGetResponse = AiSettingsResponse;
