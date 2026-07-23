import { FastifyReply } from "fastify";

export async function listModels(_req: any, reply: FastifyReply) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned ${res.status}`);
    }

    const data = await res.json();
    const models: any[] = data?.data || [];

    const mapped = models.map((m: any) => ({
      id: m.id,
      name: m.name,
      free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
      description: m.description || "",
    }));

    mapped.sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return reply
      .header("Cache-Control", "public, max-age=3600, s-maxage=3600")
      .send({ models: mapped });
  } catch (error) {
    console.error("Error fetching models:", error);
    return reply.status(500).send({ error: "Failed to fetch models" });
  }
}
