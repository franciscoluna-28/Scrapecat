import { FastifyRequest, FastifyReply } from "fastify";
import {
  listCredentials,
  createCredential,
  deleteCredential,
  verifyCredential,
} from "../services/credentials";
import { addCredentialSchema, credentialIdParamsSchema, verifyCredentialSchema } from "../schemas";

export async function listKeys(
  req: FastifyRequest<{ Querystring: { provider?: string } }>,
  reply: FastifyReply,
) {
  try {
    const keys = await listCredentials(req.query.provider);
    return reply.send({ keys });
  } catch (error) {
    console.error("Error listing credentials:", error);
    return reply.status(500).send({ error: "Failed to list credentials" });
  }
}

export async function addKey(
  req: FastifyRequest<{ Body: { provider: string; name?: string; key: string } }>,
  reply: FastifyReply,
) {
  try {
    const parsed = addCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const id = await createCredential(parsed.data);
    return reply.code(201).send({ id });
  } catch (error: any) {
    if (error?.message?.startsWith("Unsupported provider")) {
      return reply.status(400).send({ error: error.message });
    }
    console.error("Error adding credential:", error);
    return reply.status(500).send({ error: "Failed to add credential" });
  }
}

export async function deleteKey(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const parsed = credentialIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid credential ID" });
    }

    const deleted = await deleteCredential(parsed.data.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Credential not found" });
    }

    return reply.code(204).send();
  } catch (error) {
    console.error("Error deleting credential:", error);
    return reply.status(500).send({ error: "Failed to delete credential" });
  }
}

export async function verifyKey(
  req: FastifyRequest<{ Body: { provider: string; key: string } }>,
  reply: FastifyReply,
) {
  try {
    const parsed = verifyCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const valid = await verifyCredential(parsed.data.provider, parsed.data.key);
    return reply.send({ valid });
  } catch (error) {
    console.error("Error verifying credential:", error);
    return reply.status(500).send({ error: "Failed to verify credential" });
  }
}
