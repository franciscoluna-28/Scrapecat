import type { FastifyReply, FastifyRequest } from "fastify";
import type { Static } from "@sinclair/typebox";
import { env } from "@/config/env";
import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider";
import {
  connectGitProvider,
  disconnectGitProvider,
  getGitProviderConnection,
} from "@/gitConnections/services";
import {
  ConnectGitProviderBody,
  GitProviderParams,
} from "@/gitConnections/schemas";

function unimplementedProvider(provider: GitProviderId): string | null {
  try {
    getGitProviderConfig(provider);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export async function connectProvider(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoRestrictKeys) {
    return reply
      .status(403)
      .send({ error: "Git provider tokens are managed by the server in demo mode" });
  }

  const { provider } = req.params as Static<typeof GitProviderParams>;
  const { token } = req.body as Static<typeof ConnectGitProviderBody>;

  const unsupported = unimplementedProvider(provider);
  if (unsupported) return reply.status(400).send({ error: unsupported });

  try {
    return reply.code(201).send(await connectGitProvider(provider, token));
  } catch (error) {
    console.error(`Error connecting ${provider}:`, error);
    return reply.status(400).send({ error: "Invalid token or insufficient scopes" });
  }
}

export async function getProviderConnection(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider } = req.params as Static<typeof GitProviderParams>;

  const unsupported = unimplementedProvider(provider);
  if (unsupported) return reply.status(400).send({ error: unsupported });

  try {
    return reply.send(await getGitProviderConnection(provider));
  } catch (error) {
    console.error(`Error reading ${provider} connection:`, error);
    return reply.status(500).send({ error: "Failed to read git provider connection" });
  }
}

export async function disconnectProvider(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (env.isDemoRestrictKeys) {
    return reply
      .status(403)
      .send({ error: "Git provider tokens are managed by the server in demo mode" });
  }

  const { provider } = req.params as Static<typeof GitProviderParams>;

  const unsupported = unimplementedProvider(provider);
  if (unsupported) return reply.status(400).send({ error: unsupported });

  try {
    const deleted = await disconnectGitProvider(provider);
    if (!deleted) {
      return reply.status(404).send({ error: "No connected git provider found" });
    }
    return reply.code(204).send();
  } catch (error) {
    console.error(`Error disconnecting ${provider}:`, error);
    return reply.status(500).send({ error: "Failed to disconnect git provider" });
  }
}
