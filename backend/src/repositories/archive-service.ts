import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { getArchiveStore, type ArchiveKey } from "@/shared/storage";
import { runGit, authArgs } from "@/repositories/git";
import { resolveGithubToken } from "@/github/token";

export type RepoArchive = {
  owner: string;
  repo: string;
  branch: string;
  dir: string;
  tipSha: string;
};

const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
const archiveLocks = new Map<string, Promise<RepoArchive>>();

/**
 * `s3` mode treats local disk as disposable: each job gets its own scratch dir
 * under `REPO_ARCHIVE_DIR/jobs/{jobId}/`, hydrated from S3 and wiped afterwards.
 * `fs` mode keeps the persistent shared dir so incremental fetches stay warm.
 */
function usesJobScratch(): boolean {
  return env.ARCHIVE_STORE === "s3";
}

function jobScratchRoot(): string {
  return path.resolve(env.REPO_ARCHIVE_DIR, "jobs");
}

function archiveDir(owner: string, repo: string, branch: string, jobId?: string): string {
  // Always use an absolute path. The clone runs from the archive parent, so a
  // relative destination would be resolved twice on Windows.
  const base =
    usesJobScratch() && jobId
      ? path.join(jobScratchRoot(), jobId)
      : env.REPO_ARCHIVE_DIR;
  return path.resolve(base, owner, repo, branch);
}

function remoteUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

async function isRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function removeIncompleteArchive(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    throw new Error(
      `Unable to clean incomplete repository archive at ${dir}: ${(error as Error).message}`,
    );
  }
}

/**
 * Ensures a local clone of `owner/repo` at `branch` under
 * `REPO_ARCHIVE_DIR/{owner}/{repo}/{branch}/` (or a job-scoped dir in s3 mode).
 * Clones on first access with the native `git` binary, then fetches to keep the
 * branch current (incremental — only new objects are transferred). Returns the
 * archive dir and the resolved tip SHA.
 *
 * The clone is bare-ish (`--no-checkout` — only `.git`, no working tree, since
 * nothing reads file contents). A plain `git fetch origin` updates the
 * remote-tracking ref; the local branch ref is then fast-forwarded with
 * `git update-ref` so the rest of the pipeline can keep reading `ref: branch`.
 *
 * Before cloning, the archive store is asked to hydrate the dir from its warm
 * cache (no-op in fs mode); after clone/fetch the store is asked to dehydrate
 * it (also a no-op in fs mode), skipping the write when the cached tip already
 * matches. Clone/fetch/log/diff themselves are unchanged.
 */
async function ensureArchiveUnlocked(opts: {
  owner: string;
  repo: string;
  branch: string;
  jobId?: string;
}): Promise<RepoArchive> {
  const { owner, repo, branch, jobId } = opts;
  const dir = archiveDir(owner, repo, branch, jobId);
  const url = remoteUrl(owner, repo);
  const token = await resolveGithubToken();
  const store = getArchiveStore();
  const key: ArchiveKey = { owner, repo, branch };

  await fs.mkdir(path.dirname(dir), { recursive: true });

  let existed = await isRepo(dir);
  if (!existed) {
    // A clone interrupted before .git was created can leave the destination
    // behind. Git refuses to clone into any existing non-empty directory.
    await removeIncompleteArchive(dir);
    await fs.mkdir(path.dirname(dir), { recursive: true });

    const hydrated = await timed("archive.hydrate", { owner, repo, branch, store: env.ARCHIVE_STORE }, () =>
      store.hydrate(key, dir),
    );
    if (hydrated) {
      existed = true;
      logger.info(
        { owner, repo, branch, dir, tipSha: hydrated.tipSha, store: env.ARCHIVE_STORE },
        "archive restored from cache",
      );
    }
  }

  await timed(`archive.${existed ? "fetch" : "clone"}`, { owner, repo, branch, url }, async () => {
    if (existed) {
      await runGit({
        cwd: dir,
        args: [...authArgs(token), "fetch", "origin"],
        timeoutMs: TRANSFER_TIMEOUT_MS,
        label: "git fetch",
      });
      const tip = (await runGit({ cwd: dir, args: ["rev-parse", `origin/${branch}`] })).trim();
      await runGit({
        cwd: dir,
        args: ["update-ref", `refs/heads/${branch}`, tip],
        label: "git update-ref",
      });
    } else {
      const cloneDir = `${dir}.clone-${randomUUID()}`;
      await runGit({
        cwd: path.dirname(dir),
        args: [
          ...authArgs(token),
          "clone",
          "--single-branch",
          "--branch",
          branch,
          "--no-checkout",
          url,
          cloneDir,
        ],
        timeoutMs: TRANSFER_TIMEOUT_MS,
        label: "git clone",
      });
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rename(cloneDir, dir);
    }
  });

  const tipSha = (await runGit({ cwd: dir, args: ["rev-parse", branch] })).trim();
  await store.dehydrate(dir, key, tipSha);
  logger.info(
    { owner, repo, branch, dir, tipSha, action: existed ? "fetch" : "clone" },
    "archive ready",
  );
  return { owner, repo, branch, dir, tipSha };
}

export async function ensureArchive(opts: {
  owner: string;
  repo: string;
  branch: string;
  jobId?: string;
}): Promise<RepoArchive> {
  const dir = archiveDir(opts.owner, opts.repo, opts.branch, opts.jobId);
  const active = archiveLocks.get(dir);
  if (active) return active;

  const operation = ensureArchiveUnlocked(opts).finally(() => {
    if (archiveLocks.get(dir) === operation) archiveLocks.delete(dir);
  });
  archiveLocks.set(dir, operation);
  return operation;
}

/**
 * Removes a job's disposable scratch dir. No-op unless the archive store is
 * `s3` (fs mode keeps its persistent shared archive).
 */
export async function wipeJobScratch(jobId: string): Promise<void> {
  if (!usesJobScratch()) return;
  const dir = path.join(jobScratchRoot(), jobId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    logger.info({ jobId, dir }, "job scratch wiped");
  } catch (error) {
    logger.warn({ jobId, dir, err: (error as Error).message }, "job scratch wipe failed");
  }
}

/**
 * Startup sweep for s3 mode: any `jobs/*` dirs left over from a crashed worker
 * are stale, since s3 scratch is never resumed across jobs.
 */
export async function sweepStaleJobScratch(): Promise<void> {
  if (!usesJobScratch()) return;
  const root = jobScratchRoot();
  try {
    await fs.rm(root, { recursive: true, force: true });
    logger.info({ root }, "stale job scratch swept");
  } catch (error) {
    logger.warn({ root, err: (error as Error).message }, "stale job scratch sweep failed");
  }
}
