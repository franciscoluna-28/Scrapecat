import { Type, type Static } from "@sinclair/typebox";

const AiSettingsBody = Type.Object({
  reportProvider: Type.Union([Type.Literal("openrouter"), Type.Literal("deepseek"), Type.Literal("openai"), Type.Literal("ollama")]),
  reportModel: Type.String({ minLength: 1 }),
  embeddingProvider: Type.Union([Type.Literal("openrouter"), Type.Literal("ollama")]),
  embeddingModel: Type.String({ minLength: 1 }),
});

export { AiSettingsBody as AISettingsBody };

export type AISettingsInput = Static<typeof AiSettingsBody>;

const AiSettingsResponse = Type.Object({
  reportProvider: Type.Union([Type.Literal("openrouter"), Type.Literal("deepseek"), Type.Literal("openai"), Type.Literal("ollama")]),
  reportModel: Type.String(),
  embeddingProvider: Type.Union([Type.Literal("openrouter"), Type.Literal("ollama")]),
  embeddingModel: Type.String(),
});

export const AISettingsGetResponse = AiSettingsResponse;
