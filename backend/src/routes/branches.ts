import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "../services/git-provider";
import { ownerRepoParamsSchema } from "../schemas";

export async function listBranches(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = ownerRepoParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }
  const { owner, repo } = parsed.data;

  try {
    const branches = await getGitProvider().listBranches(owner, repo);
    return reply.send({ branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return reply.status(500).send({ error: "Failed to fetch branches" });
  }
}
