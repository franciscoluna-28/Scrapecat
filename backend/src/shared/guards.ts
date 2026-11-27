import type { preHandlerHookHandler } from "fastify";
import { httpErrors } from "@/shared/errors";
import { env } from "@/shared/config/env";

/**
 * Route guard that rejects with 403 when `predicate()` is true. Registered as
 * a `preHandler` (after validation) so invalid input still returns 400 first,
 * matching the previous in-handler guard behavior.
 */
export function forbidIf(
  predicate: () => boolean,
  message: string,
): preHandlerHookHandler {
  return async () => {
    if (predicate()) throw httpErrors.forbidden(message);
  };
}

/** Rejects writes when BYOK is disabled (demo deployments). */
export function demoWriteGuard(message: string): preHandlerHookHandler {
  return forbidIf(() => env.isDemoRestrictKeys, message);
}

/** Rejects when the whole reports feature is disabled (demo deployments). */
export function demoModeGuard(message: string): preHandlerHookHandler {
  return forbidIf(() => env.isDemoMode, message);
}

/** Rejects adding repositories when `ALLOW_ADD_REPOS=false`. */
export function allowAddReposGuard(message: string): preHandlerHookHandler {
  return forbidIf(() => !env.allowAddRepos, message);
}

/**
 * Demo mode can only read public GitHub repositories. Runs before the handler
 * so the discovery handlers no longer repeat the `unsupportedInDemo` check.
 */
export const demoProviderGuard: preHandlerHookHandler = async (request) => {
  if (!env.isDemoMode) return;
  const provider = (request.query as { provider?: string } | undefined)?.provider;
  if (provider && provider !== "github") {
    throw httpErrors.badRequest("Demo mode only supports GitHub repositories");
  }
};
