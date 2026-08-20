import fs from "node:fs";
import git from "isomorphic-git";
import { logger } from "@/shared/logger";

export type LocalCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  tree: string;
  parentSha: string | null;
};

/**
 * Lists commits reachable from `ref` whose author date falls within
 * `[since, until]`. Uses isomorphic-git `since` (ms epoch) as an early-exit
 * bound for the walk, then filters the upper bound in JS — `until` semantics
 * in isomorphic-git's log are unreliable.
 */
export async function listCommitsInRange(opts: {
  dir: string;
  ref: string;
  since?: Date;
  until?: Date;
}): Promise<LocalCommit[]> {
  const untilMs = opts.until ? opts.until.getTime() : undefined;
  const start = performance.now();

  const log = await git.log({
    fs,
    dir: opts.dir,
    ref: opts.ref,
    since: opts.since,
  });

  const commits = log
    .filter((c) => {
      const ts = c.commit.author.timestamp * 1000;
      if (untilMs !== undefined && ts > untilMs) return false;
      return true;
    })
    .map((c) => ({
      sha: c.oid,
      message: c.commit.message.trim(),
      author: c.commit.author.name ?? c.commit.author.email ?? "",
      date: new Date(c.commit.author.timestamp * 1000).toISOString(),
      tree: c.commit.tree,
      parentSha: c.commit.parent[0] ?? null,
    }));

  logger.info(
    {
      dir: opts.dir,
      ref: opts.ref,
      since: opts.since?.toISOString(),
      until: opts.until?.toISOString(),
      commitsFound: commits.length,
      durationMs: Math.round(performance.now() - start),
    },
    "listCommitsInRange complete",
  );

  return commits;
}
