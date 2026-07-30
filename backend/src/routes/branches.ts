import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "../services/git-provider";

export async function listBranches(
  req: FastifyRequest<{ Params: { owner: string; repo: string } }>,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params;

  try {
    const branches = await getGitProvider().listBranches(owner, repo);
    return reply.send({ branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return reply.status(500).send({ error: "Failed to fetch branches" });
  }
}
