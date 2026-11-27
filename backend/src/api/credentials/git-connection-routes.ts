import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { httpErrors } from "@/shared/errors";
import { demoWriteGuard } from "@/shared/guards";
import {
  connectGitProvider,
  disconnectGitProvider,
  getGitProviderConnection,
} from "@/api/credentials/git-connections";
import {
  ConnectGitProviderRoute,
  DisconnectGitProviderRoute,
  GetGitProviderConnectionRoute,
} from "@/api/credentials/schemas";

const DEMO_TOKENS_MESSAGE =
  "Git provider tokens are managed by the server in demo mode";

export async function connectProvider(
  req: TypeBoxRequest<typeof ConnectGitProviderRoute>,
  reply: TypeBoxReply<typeof ConnectGitProviderRoute>,
) {
  const { provider } = req.params;
  const { token } = req.body;
  const connection = await connectGitProvider(provider, token);
  reply.code(201);
  return connection;
}

export async function getProviderConnection(
  req: TypeBoxRequest<typeof GetGitProviderConnectionRoute>,
  _reply: TypeBoxReply<typeof GetGitProviderConnectionRoute>,
) {
  return getGitProviderConnection(req.params.provider);
}

export async function disconnectProvider(
  req: TypeBoxRequest<typeof DisconnectGitProviderRoute>,
  reply: TypeBoxReply<typeof DisconnectGitProviderRoute>,
) {
  const deleted = await disconnectGitProvider(req.params.provider);
  if (!deleted) throw httpErrors.notFound("No connected git provider found");
  reply.code(204);
  return;
}

export const gitConnectionRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    "/git-providers/:provider/connection",
    {
      schema: ConnectGitProviderRoute,
      preHandler: demoWriteGuard(DEMO_TOKENS_MESSAGE),
    },
    connectProvider,
  );

  app.get(
    "/git-providers/:provider/connection",
    { schema: GetGitProviderConnectionRoute },
    getProviderConnection,
  );

  app.delete(
    "/git-providers/:provider/connection",
    {
      schema: DisconnectGitProviderRoute,
      preHandler: demoWriteGuard(DEMO_TOKENS_MESSAGE),
    },
    disconnectProvider,
  );
};
