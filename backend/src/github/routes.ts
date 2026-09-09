import type { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGithubToken } from "@/github/token";
import { encrypt, maskApiKey } from "@/credentials/encryption";
import {
  upsertCredential,
  getLatestCredential,
  deleteCredentialById,
} from "@/credentials/stores/credentials-store";
import type { CredentialProvider } from "@/db/schema";

const GITHUB_PROVIDER: CredentialProvider = "github";

/** Validates a token by calling the authenticated GitHub /user endpoint. */
async function verifyTokenWithGitHub(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: string };
    return data.login ?? null;
  } catch {
    return null;
  }
}

export async function createGitHubToken(req: FastifyRequest, reply: FastifyReply) {
  const { token } = req.body as { token: string };

  const login = await verifyTokenWithGitHub(token);
  if (!login) {
    return reply.status(400).send({ error: "Invalid GitHub token or insufficient scopes" });
  }

  await upsertCredential({
    provider: GITHUB_PROVIDER,
    encryptedKey: encrypt(token),
    keyHint: maskApiKey(token),
  });

  return reply.code(201).send({ connected: true, source: "token", login });
}

export async function getGitHubConnection(_req: FastifyRequest, reply: FastifyReply) {
  const token = await resolveGithubToken();
  if (!token) {
    return reply.send({ connected: false, source: "none" as const });
  }

  const stored = await getLatestCredential(GITHUB_PROVIDER);
  const source = stored ? ("token" as const) : ("env" as const);

  let login: string | undefined;
  try {
    login = (await getGitProvider(token).verifyConnection()).login;
  } catch {
    login = undefined;
  }

  return reply.send({ connected: true, source, login });
}

export async function deleteGitHubConnection(_req: FastifyRequest, reply: FastifyReply) {
  const stored = await getLatestCredential(GITHUB_PROVIDER);
  if (!stored) {
    return reply.status(404).send({ error: "No connected GitHub account found" });
  }

  await deleteCredentialById(stored.id);
  return reply.code(204).send();
}
