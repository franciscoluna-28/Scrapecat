import { execFile } from "node:child_process";
import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";

const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;

/**
 * Runs a native `git` command. Git executes in its own C process, so the
 * heavy work costs ~0 Node.js RAM and never blocks the event loop.
 *
 * `cwd` is optional — clone/fetch may need to run before the target dir
 * exists. Errors carry git's stderr (never the full argv, which could contain
 * the auth header token).
 */
export async function runGit(opts: {
  cwd?: string;
  args: string[];
  input?: string;
  timeoutMs?: number;
  label?: string;
  env?: Record<string, string>;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      opts.args,
      {
        cwd: opts.cwd,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: opts.timeoutMs,
        env: opts.env ? { ...process.env, ...opts.env } : undefined,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || "").trim();
          const err = new Error(`${opts.label ?? "git"} failed${detail ? `: ${detail}` : ""}`);
          if (/not found in upstream origin|couldn't find remote ref/i.test(stderr || "")) {
            (err as any).code = "BranchNotFound";
          }
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
    if (opts.input !== undefined) {
      // The child can exit before consuming stdin (e.g. bad revision); a
      // swallowed EPIPE must not surface as an unhandled stream error.
      child.stdin?.on("error", () => {});
      child.stdin?.end(opts.input);
    }
  });
}

/**
 * Auth environment for HTTPS clones, provider-aware. The token travels via
 * `GIT_CONFIG_*` environment variables, so it never appears in the URL or
 * process argv. With no token, git clones public repositories anonymously.
 */
export function authEnv(
  provider: GitProviderId,
  token?: string | null,
): Record<string, string> | undefined {
  if (!token) return undefined;
  const authorization = getGitProviderConfig(provider).authorization(token);
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: ${authorization}`,
  };
}
