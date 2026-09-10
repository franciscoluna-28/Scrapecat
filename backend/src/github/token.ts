import { env } from "@/config/env";
import { decrypt } from "@/credentials/encryption";
import { getLatestCredential } from "@/credentials/stores/credentials-store";
import type { CredentialProvider } from "@/db/schema";

const GITHUB_PROVIDER: CredentialProvider = "github";

/**
 * Resolves the GitHub token to use for discovery + cloning, in precedence order:
 *   1. The encrypted Personal Access Token stored under provider "github"
 *      (set via the guided connect flow in routes.ts)
 *   2. The server-side GITHUB_TOKEN env var (headless / docker fallback)
 *   3. null — Octokit/git then run unauthenticated (public repos, low rate limit)
 */
export async function resolveGithubToken(): Promise<string | null> {
  const stored = await getLatestCredential(GITHUB_PROVIDER);
  if (stored) {
    return decrypt(stored.encryptedKey);
  }
  return env.GITHUB_TOKEN || null;
}
