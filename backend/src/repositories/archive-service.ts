import fs from "node:fs/promises";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { env } from "@/config/env";

export type RepoArchive = {
  owner: string;
  repo: string;
  branch: string;
  dir: string;
  tipSha: string;
};

function archiveDir(owner: string, repo: string, branch: string): string {
  return path.join(env.REPO_ARCHIVE_DIR, owner, repo, branch);
}

function remoteUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

function auth() {
  return { username: env.GITHUB_TOKEN, password: "" };
}

async function isRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures a local git clone of `owner/repo` at `branch` exists under
 * `REPO_ARCHIVE_DIR/{owner}/{repo}/{branch}/`. Clones on first access, then
 * fetches to keep the branch ref current (incremental — only new objects are
 * transferred). Returns the archive dir and the resolved tip SHA.
 *
 * This is the batch-ingestion source of truth: once cloned, every commit and
 * diff for the branch is read from disk via isomorphic-git — no per-item API
 * calls, no pagination, no watermark.
 */
export async function ensureArchive(opts: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<RepoArchive> {
  const { owner, repo, branch } = opts;
  const dir = archiveDir(owner, repo, branch);
  const url = remoteUrl(owner, repo);

  await fs.mkdir(path.dirname(dir), { recursive: true });

  if (await isRepo(dir)) {
    await git.fetch({ fs, http, dir, url, ref: branch, singleBranch: true, onAuth: auth });
  } else {
    await git.clone({ fs, http, dir, url, ref: branch, singleBranch: true, onAuth: auth });
  }

  const tipSha = await git.resolveRef({ fs, dir, ref: branch });
  return { owner, repo, branch, dir, tipSha };
}
