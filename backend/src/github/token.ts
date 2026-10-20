import { resolveGitToken } from "@/shared/integrations/git-provider/token";

/**
 * GitHub-specific alias for the generic token resolver. The GitHub connection
 * and verification flows are explicitly GitHub-scoped; the shared ingestion
 * pipeline should call `resolveGitToken(provider)` instead.
 */
export async function resolveGithubToken(): Promise<string | null> {
  return resolveGitToken("github");
}
