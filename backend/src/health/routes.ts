import { FastifyRequest, FastifyReply } from "fastify";
import { checkDatabase } from "@/health/services";

export async function health(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: "ok" });
}

export async function ready(_req: FastifyRequest, reply: FastifyReply) {
  const ok = await checkDatabase();
  return ok
    ? reply.send({ status: "ok" })
    : reply.status(503).send({ status: "error" });
}
