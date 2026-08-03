import { FastifyRequest, FastifyReply } from "fastify";

export async function health(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: "ok" });
}
