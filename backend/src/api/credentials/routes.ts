import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { env } from "@/shared/config/env";
import { httpErrors } from "@/shared/errors";
import { demoWriteGuard } from "@/shared/guards";
import {
  listCredentials,
  createCredential,
  deleteCredential,
  verifyCredential,
} from "@/api/credentials/services";
import {
  AddCredentialRoute,
  DeleteCredentialRoute,
  ListCredentialsRoute,
  VerifyCredentialRoute,
} from "@/api/credentials/schemas";

const DEMO_KEYS_MESSAGE =
  "API keys are managed by the server in demo mode";

export async function listKeys(
  req: TypeBoxRequest<typeof ListCredentialsRoute>,
  _reply: TypeBoxReply<typeof ListCredentialsRoute>,
) {
  // Demo deployments don't expose BYOK — the server's env keys are used.
  if (env.isDemoRestrictKeys) return { keys: [] };
  return { keys: await listCredentials(req.query.provider) };
}

export async function addKey(
  req: TypeBoxRequest<typeof AddCredentialRoute>,
  reply: TypeBoxReply<typeof AddCredentialRoute>,
) {
  const { provider, key } = req.body;
  const id = await createCredential({ provider, key });
  reply.code(201);
  return { id };
}

export async function deleteKey(
  req: TypeBoxRequest<typeof DeleteCredentialRoute>,
  reply: TypeBoxReply<typeof DeleteCredentialRoute>,
) {
  const deleted = await deleteCredential(req.params.id);
  if (!deleted) throw httpErrors.notFound("Credential not found");
  reply.code(204);
  return;
}

export async function verifyKey(
  req: TypeBoxRequest<typeof VerifyCredentialRoute>,
  _reply: TypeBoxReply<typeof VerifyCredentialRoute>,
) {
  const { provider, key } = req.body;
  return { valid: await verifyCredential(provider, key) };
}

export const credentialRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    "/credentials",
    { schema: ListCredentialsRoute },
    listKeys,
  );

  app.post(
    "/credentials",
    { schema: AddCredentialRoute, preHandler: demoWriteGuard(DEMO_KEYS_MESSAGE) },
    addKey,
  );

  app.delete(
    "/credentials/:id",
    {
      schema: DeleteCredentialRoute,
      preHandler: demoWriteGuard(DEMO_KEYS_MESSAGE),
    },
    deleteKey,
  );

  app.post(
    "/credentials/verify",
    { schema: VerifyCredentialRoute },
    verifyKey,
  );
};
