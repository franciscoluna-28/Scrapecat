import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { cloneUrl } from "@/shared/integrations/git-provider/urls";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import type { GitProviderId } from "@/shared/integrations/git-provider/registry";
import { runGit, authEnv } from "@/rag/git/git";

export type RepoWorkspace = {
  owner: string;
  repo: string;
  branch: string;
  dir: string;
  tipSha: string;
};

const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
const TIP_TIMEOUT_MS = 60 * 1000;

/** Ephemeral clones live here; the worker deletes them after each job. */
export const WORKSPACE_ROOT = path.join(os.tmpdir(), "scrapecat");

/**
 * Clones one branch into a throwaway directory. Blobless (`--filter=blob:none`)
 * keeps the download to commits/trees; diffs fetch only the blobs they need.
 * Call `disposeWorkspace` in a `finally` so success, failure, and crashes all
 * clean up (crashes are swept on the next worker boot).
 */
export async function createWorkspace(opts: {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
}): Promise<RepoWorkspace> {
  const { gitProvider, owner, repo, branch } = opts;
  const dir = path.join(WORKSPACE_ROOT, randomUUID());
  const url = cloneUrl(gitProvider, owner, repo);
  const auth = authEnv(gitProvider, await resolveGitToken(gitProvider));

  await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

  try {
    await timed("workspace.clone", { owner, repo, branch, url }, () =>
      runGit({
        args: [
          "clone",
          "--single-branch",
          "--branch",
          branch,
          "--no-checkout",
          "--filter=blob:none",
          url,
          dir,
        ],
        env: auth,
        timeoutMs: TRANSFER_TIMEOUT_MS,
        label: "git clone",
      }),
    );
  } catch (error) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  const tipSha = (await runGit({ cwd: dir, args: ["rev-parse", branch] })).trim();
  logger.info({ owner, repo, branch, dir, tipSha }, "workspace ready");
  return { owner, repo, branch, dir, tipSha };
}

export async function disposeWorkspace(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ dir, err: (error as Error).message }, "workspace cleanup failed");
  }
}

/** Deletes clones left behind by a crashed worker. Only one worker runs at a time. */
export async function sweepStaleWorkspaces(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(WORKSPACE_ROOT);
  } catch {
    return;
  }
  await Promise.all(
    entries.map((entry) => disposeWorkspace(path.join(WORKSPACE_ROOT, entry))),
  );
  if (entries.length > 0) {
    logger.info({ count: entries.length }, "stale workspaces swept");
  }
}

/** Resolves the remote tip without cloning, so unchanged branches cost nothing. */
export async function remoteTipSha(opts: {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
}): Promise<string> {
  const { gitProvider, owner, repo, branch } = opts;
  const url = cloneUrl(gitProvider, owner, repo);
  const auth = authEnv(gitProvider, await resolveGitToken(gitProvider));

  const stdout = await runGit({
    args: ["ls-remote", "--heads", url, `refs/heads/${branch}`],
    env: auth,
    timeoutMs: TIP_TIMEOUT_MS,
    label: "git ls-remote",
  });

  const line = stdout.split(/\r?\n/).find((entry) => entry.trim().length > 0);
  const sha = line?.split(/\s+/)[0]?.trim();
  if (!sha) {
    const error = new Error(`Branch not found: ${branch}`) as Error & { code?: string };
    error.code = "BranchNotFound";
    throw error;
  }
  return sha;
}
