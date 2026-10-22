/**
 * Builds the canonical chat URL: keeps unrelated params (e.g. `branch`), drops
 * the one-shot `q` prompt, and pins the active project/session.
 */
export function buildChatUrl(
  pathname: string,
  search: string,
  projectId: string,
  sessionId: string,
): string {
  const params = new URLSearchParams(search);
  params.delete("q");
  params.set("project", projectId);
  params.set("session", sessionId);
  return `${pathname}?${params.toString()}`;
}
