import { FastifyRequest, FastifyReply } from "fastify";

const OPENROUTER_FALLBACK = [
  { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B A4B", free: true, description: "" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", free: true, description: "" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", free: true, description: "" },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", free: true, description: "" },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS-20B", free: true, description: "" },
  { id: "cohere/north-mini-code:free", name: "North Mini Code", free: true, description: "" },
];

const DEEPSEEK_FALLBACK = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", free: false, description: "" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", free: false, description: "" },
  { id: "deepseek-chat", name: "DeepSeek Chat", free: false, description: "" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", free: false, description: "" },
];

const OPENAI_FALLBACK = [
  { id: "gpt-4o", name: "GPT-4o", free: false, description: "" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", free: false, description: "" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", free: false, description: "" },
  { id: "o3-mini", name: "o3-mini", free: false, description: "" },
];

const PROVIDER_FALLBACKS: Record<string, typeof DEEPSEEK_FALLBACK> = {
  deepseek: DEEPSEEK_FALLBACK,
  openai: OPENAI_FALLBACK,
};

export async function listModels(
  req: FastifyRequest<{ Querystring: { provider?: string } }>,
  reply: FastifyReply,
) {
  const provider = req.query.provider;

  if (provider && provider !== "openrouter") {
    const list = PROVIDER_FALLBACKS[provider];
    if (!list) return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    return reply.send({ models: list.map((m) => ({ ...m, provider })) });
  }

  let openrouterModels = OPENROUTER_FALLBACK;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      openrouterModels = (data?.data || [])
        .filter((m: any) => !m.pricing || (m.pricing?.prompt == 0 && m.pricing?.completion == 0))
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          free: !m.pricing || (m.pricing?.prompt == 0 && m.pricing?.completion == 0),
          description: m.description || "",
        }));
    }
  } catch {}

  if (provider === "openrouter") {
    return reply.send({ models: openrouterModels.map((m) => ({ ...m, provider: "openrouter" })) });
  }

  const all = [
    ...openrouterModels.map((m) => ({ ...m, provider: "openrouter" as const })),
    ...DEEPSEEK_FALLBACK.map((m) => ({ ...m, provider: "deepseek" as const })),
    ...OPENAI_FALLBACK.map((m) => ({ ...m, provider: "openai" as const })),
  ];

  return reply.send({ models: all });
}
