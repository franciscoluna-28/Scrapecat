import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "../services/git-provider";
import { listReposQuerySchema } from "../schemas";

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = listReposQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }
  const { type, sort, direction, per_page } = parsed.data;

  try {
    const repositories = await getGitProvider().listRepositories({
      type: type || "all",
      sort: sort || "updated",
      direction: direction || "desc",
      perPage: parseInt(per_page || "10"),
    });
    return reply.send(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return reply.status(500).send({ error: "Failed to fetch repositories" });
  }
}
