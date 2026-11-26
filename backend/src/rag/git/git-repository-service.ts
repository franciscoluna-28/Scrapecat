import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { cloneUrl, commitUrl } from "@/shared/integrations/git-provider/urls";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import type { GitProviderId } from "@/shared/integrations/git-provider/registry";
import { runGit, authEnv } from "@/rag/git/git";
import {
  listCommitsInRange,
  type LocalCommit,
} from "@/rag/git/git-reader";
import {
  getCommitsChangedFiles,
  type CommitChangedStats,
} from "@/rag/git/git-diff";

export type GitRepositoryRef = {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
};

/** A throwaway clone plus the pipeline-facing reads for one branch. */
export type GitRepositoryHandle = {
  dir: string;
  tipSha: string;
  listCommits(opts: {
    since?: Date;
    until?: Date;
  }): Promise<LocalCommit[]>;
  changedFiles(shas: string[]): Promise<Map<string, CommitChangedStats>>;
  commitUrl(sha: string): string;
  dispose(): Promise<void>;
};

type GitRepositoryServiceDeps = {
  runGit: typeof runGit;
  authEnv: typeof authEnv;
  cloneUrl: typeof cloneUrl;
  commitUrl: typeof commitUrl;
  resolveGitToken: typeof resolveGitToken;
  listCommitsInRange: typeof listCommitsInRange;
  getCommitsChangedFiles: typeof getCommitsChangedFiles;
  workspaceRoot: string;
};

const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
const TIP_TIMEOUT_MS = 60 * 1000;

const defaultDeps: GitRepositoryServiceDeps = {
  runGit,
  authEnv,
  cloneUrl,
  commitUrl,
  resolveGitToken,
  listCommitsInRange,
  getCommitsChangedFiles,
  workspaceRoot: path.join(os.tmpdir(), "scrapecat"),
};

/**
 * Owns every git operation the ingestion pipeline needs:
 * - `tip` resolves a branch head without cloning (`git ls-remote`).
 * - `open` clones one branch into a throwaway workspace and returns a handle
 *   for log/diff reads.
 * - `sweep` clears workspaces left by a crashed worker.
 *
 * Callers use the service, never `runGit`/clone URLs/token resolution directly.
 */
export function createGitRepositoryService(
  overrides: Partial<GitRepositoryServiceDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };

  function remoteUrl(ref: GitRepositoryRef): string {
    return deps.cloneUrl(ref.gitProvider, ref.owner, ref.repo);
  }

  async function authFor(ref: GitRepositoryRef) {
    return deps.authEnv(
      ref.gitProvider,
      await deps.resolveGitToken(ref.gitProvider),
    );
  }

  async function tip(ref: GitRepositoryRef): Promise<string> {
    const url = remoteUrl(ref);
    const stdout = await deps.runGit({
      args: ["ls-remote", "--heads", url, `refs/heads/${ref.branch}`],
      env: await authFor(ref),
      timeoutMs: TIP_TIMEOUT_MS,
      label: "git ls-remote",
    });

    const line = stdout.split(/\r?\n/).find((entry) => entry.trim().length > 0);
    const sha = line?.split(/\s+/)[0]?.trim();
    if (!sha) {
      const error = new Error(`Branch not found: ${ref.branch}`) as Error & {
        code?: string;
      };
      error.code = "BranchNotFound";
      throw error;
    }
    return sha;
  }

  async function open(ref: GitRepositoryRef): Promise<GitRepositoryHandle> {
    const { gitProvider, owner, repo, branch } = ref;
    const dir = path.join(deps.workspaceRoot, randomUUID());
    const url = remoteUrl(ref);
    const auth = await authFor(ref);

    await fs.mkdir(deps.workspaceRoot, { recursive: true });

    try {
      await timed("ingest.createWorkspace", { owner, repo, branch, url }, () =>
        deps.runGit({
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

    let tipSha: string;
    try {
      tipSha = (await deps.runGit({ cwd: dir, args: ["rev-parse", branch] })).trim();
    } catch (error) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }

    logger.info({ owner, repo, branch, dir, tipSha }, "workspace ready");

    let disposed = false;
    return {
      dir,
      tipSha,
      listCommits: (opts) =>
        timed(
          "ingest.listCommitsInRange",
          {
            owner,
            repo,
            branch,
            since: opts.since?.toISOString(),
            until: opts.until?.toISOString(),
          },
          () =>
            deps.listCommitsInRange({
              dir,
              ref: branch,
              since: opts.since,
              until: opts.until,
            }),
        ),
      changedFiles: (shas) =>
        timed(
          "ingest.getChangedFiles",
          { owner, repo, branch, count: shas.length },
          () => deps.getCommitsChangedFiles({ dir, shas }),
        ),
      commitUrl: (sha) => deps.commitUrl(gitProvider, owner, repo, sha),
      async dispose() {
        if (disposed) return;
        disposed = true;
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          logger.warn(
            { dir, err: (error as Error).message },
            "workspace cleanup failed",
          );
        }
      },
    };
  }

  async function sweep(): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(deps.workspaceRoot);
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const dir = path.join(deps.workspaceRoot, entry);
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          logger.warn(
            { dir, err: (error as Error).message },
            "workspace cleanup failed",
          );
        }
      }),
    );

    if (entries.length > 0) {
      logger.info({ count: entries.length }, "stale workspaces swept");
    }
  }

  return { tip, open, sweep };
}

export const gitRepositoryService = createGitRepositoryService();
