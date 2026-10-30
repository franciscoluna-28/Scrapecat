import { env } from "@/config/env";
import { encrypt, maskApiKey } from "@/credentials/encryption";
import { credentialsStore } from "@/credentials/stores/credentials-store";
import {
  getGitProvider,
  type GitProviderId,
} from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";

export type GitConnectionSource = "token" | "env" | "none";

export type GitConnection = {
  connected: boolean;
  source: GitConnectionSource;
  login?: string;
};

/**
 * Validates a token through the provider adapter, then stores it encrypted.
 * The provider id is also the credential key, so GitHub and GitLab tokens can
 * coexist in the same table.
 */
export async function connectGitProvider(
  provider: GitProviderId,
  token: string,
): Promise<GitConnection> {
  const status = await getGitProvider(provider, token).verifyConnection();

  await credentialsStore.upsertCredential({
    provider,
    encryptedKey: encrypt(token),
    keyHint: maskApiKey(token),
  });

  return { connected: true, source: "token", login: status.login };
}

/**
 * Reports the active connection without exposing the token. Demo mode never
 * probes the token owner's identity (`GET /user`).
 */
export async function getGitProviderConnection(
  provider: GitProviderId,
): Promise<GitConnection> {
  const token = await resolveGitToken(provider);
  if (!token) return { connected: false, source: "none" };

  const stored = await credentialsStore.getLatestCredential(provider);
  const source: GitConnectionSource = stored ? "token" : "env";

  if (env.isDemoMode) return { connected: true, source };

  let login: string | undefined;
  try {
    login = (await getGitProvider(provider, token).verifyConnection()).login;
  } catch {
    login = undefined;
  }

  return { connected: true, source, login };
}

/** Removes only the stored credential; env-provided tokens are untouched. */
export async function disconnectGitProvider(
  provider: GitProviderId,
): Promise<boolean> {
  const stored = await credentialsStore.getLatestCredential(provider);
  if (!stored) return false;
  return credentialsStore.deleteCredentialById(stored.id);
}
