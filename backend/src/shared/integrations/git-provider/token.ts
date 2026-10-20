import { env } from "@/config/env";
import { decrypt } from "@/credentials/encryption";
import { getLatestCredential } from "@/credentials/stores/credentials-store";
import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";

/**
 * Resolves the token for a git provider, in precedence order:
 *   1. the encrypted credential stored for that provider (BYOK connect flow)
 *   2. the provider's server-side env var (headless / docker / demo fallback)
 *   3. null — clone then runs unauthenticated (public repos, low rate limit)
 */
export async function resolveGitToken(provider: GitProviderId): Promise<string | null> {
  const config = getGitProviderConfig(provider);
  const stored = await getLatestCredential(provider);
  if (stored) {
    return decrypt(stored.encryptedKey);
  }
  return env[config.tokenEnvKey] || null;
}