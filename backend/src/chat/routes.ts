import { FastifyRequest, FastifyReply } from "fastify";
import { askBodySchema } from "@/chat/schemas";
import { askAboutProject, ChatError } from "@/chat/ask";

export async function ask(req: FastifyRequest, reply: FastifyReply) {
  const parsed = askBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  try {
    const { answer, sources } = await askAboutProject(parsed.data);
    return reply.send({
      answer,
      sources: sources.map((s) => ({
        commitSha: s.commitSha,
        commitMessage: s.commitMessage,
        author: s.author,
        diffSummary: s.diffSummary,
        committedAt: s.committedAt,
        similarity: s.similarity,
      })),
    });
  } catch (error: any) {
    console.error("Error answering question:", error);
    if (error instanceof ChatError) {
      return reply.status(error.status).send({ error: error.message });
    }
    if (error?.status === 429) {
      return reply.status(429).send({ error: "Rate limit reached. Please try again later." });
    }
    return reply.status(500).send({ error: "Failed to answer question" });
  }
}
