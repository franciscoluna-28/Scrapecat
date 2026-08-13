import OpenAI from "openai";
import { env } from "@/config/env";
import { resolveApiKey } from "@/credentials/services";
import { getAISettings } from "@/settings/services";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const EMBEDDING_DIMENSIONS = 1536;

export async function embedTexts(
  texts: string[],
  opts?: { model?: string; apiKey?: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey =
    opts?.apiKey || (await resolveApiKey("openrouter")) || env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing API key for embeddings (set OPENROUTER_API_KEY or store an openrouter credential)");
  }

  const settings = await getAISettings();
  const model = opts?.model || settings.embeddingModel;
  const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });

  const response = await client.embeddings.create({ model, input: texts });
  const byIndex = new Map(response.data.map((d) => [d.index, d.embedding]));
  const embeddings = texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb) throw new Error(`Embedding response missing index ${i}`);
    if (emb.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned ${emb.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
    return emb;
  });

  return embeddings;
}
