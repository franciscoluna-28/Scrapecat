import { getProviderConfig, isProviderSupported } from "@/shared/integrations/providers/registry";
import { encrypt, decrypt, maskApiKey } from "@/credentials/encryption";
import type { CredentialProvider } from "@/db/schema";
import * as credentialsStore from "@/credentials/stores/credentials-store";

export function toSafeCredential(row: Awaited<ReturnType<typeof credentialsStore.listCredentials>>[number]) {
  return {
    id: row.id,
    provider: row.provider,
    keyHint: row.keyHint,
    createdAt: row.createdAt,
  };
}

export async function listCredentials(provider?: string) {
  const rows = provider
    ? await credentialsStore.listCredentials(provider as CredentialProvider)
    : await credentialsStore.listCredentials();
  return rows.map(toSafeCredential);
}

export async function getCredential(id: string) {
  return credentialsStore.getCredentialById(id);
}

export async function createCredential(data: {
  provider: string;
  key: string;
}): Promise<string> {
  if (!isProviderSupported(data.provider)) {
    throw new Error(`Unsupported provider: ${data.provider}`);
  }

  const row = await credentialsStore.upsertCredential({
    provider: data.provider as CredentialProvider,
    encryptedKey: encrypt(data.key),
    keyHint: maskApiKey(data.key),
  });

  return row.id;
}

export async function deleteCredential(id: string): Promise<boolean> {
  return credentialsStore.deleteCredentialById(id);
}

export async function verifyCredential(provider: string, key: string): Promise<boolean> {
  const config = getProviderConfig(provider);
  if (!config) return false;

  try {
    const res = await fetch(config.verifyUrl, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function resolveApiKey(provider: string): Promise<string | null> {
  if (!isProviderSupported(provider)) return null;

  const row = await credentialsStore.getLatestCredential(provider as CredentialProvider);
  if (!row) return null;
  return decrypt(row.encryptedKey);
}
