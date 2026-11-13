import { IS_DEMO } from "@/src/shared/constants";

/**
 * Whether a pathname is part of the chat experience. In demo mode `/app` is the
 * chat home, so it counts alongside the canonical `/app/chat` route.
 */
export function isChatRoute(pathname: string): boolean {
  if (pathname.startsWith("/app/chat")) return true;
  return IS_DEMO && (pathname === "/app" || pathname === "/app/");
}

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
