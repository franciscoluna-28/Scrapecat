import { Type, type Static } from "@sinclair/typebox";
import {
  EMBEDDING_PROVIDER_NAMES,
  PROVIDER_REGISTRY,
  type ProviderName,
} from "@/shared/integrations/providers/registry";

const ChatProvider = Type.Union(
  (Object.keys(PROVIDER_REGISTRY) as ProviderName[]).map((provider) =>
    Type.Literal(provider),
  ),
);

const EmbeddingProvider = Type.Union(
  EMBEDDING_PROVIDER_NAMES.map((provider) => Type.Literal(provider)),
);

const AiSettingsBody = Type.Object({
  chatProvider: ChatProvider,
  chatModel: Type.String({ minLength: 1 }),
  embeddingProvider: EmbeddingProvider,
  embeddingModel: Type.String({ minLength: 1 }),
});

export { AiSettingsBody as AISettingsBody };

export type AISettingsInput = Static<typeof AiSettingsBody>;

const AiSettingsResponse = Type.Object({
  chatProvider: ChatProvider,
  chatModel: Type.String(),
  embeddingProvider: EmbeddingProvider,
  embeddingModel: Type.String(),
});

export const AISettingsGetResponse = AiSettingsResponse;

export const ModelsQuery = Type.Object({
  provider: Type.Optional(Type.String()),
  modality: Type.Optional(Type.Union([Type.Literal("chat"), Type.Literal("embeddings")])),
});

export const ModelsResponse = Type.Object({
  models: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      free: Type.Boolean(),
      description: Type.String(),
      provider: Type.String(),
    }),
  ),
});
