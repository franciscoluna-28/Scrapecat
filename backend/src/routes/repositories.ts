import { FastifyRequest, FastifyReply } from "fastify";
import { getAllRepositories } from "../services/github";

export async function listRepositories(
  req: FastifyRequest<{ Querystring: { type?: string; sort?: string; direction?: string; per_page?: string } }>,
  reply: FastifyReply,
) {
  const { type, sort, direction, per_page } = req.query;

  try {
    const repositories = await getAllRepositories({
      type: type || "all",
      sort: sort || "updated",
      direction: direction || "desc",
      per_page: parseInt(per_page || "10"),
    });
    return reply.send(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return reply.status(500).send({ error: "Failed to fetch repositories" });
  }
}
