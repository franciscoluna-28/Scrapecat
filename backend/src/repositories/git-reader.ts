import fs from "node:fs";
import git from "isomorphic-git";
import { TREE } from "isomorphic-git";
import { createTwoFilesPatch } from "diff";

export type LocalCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  tree: string;
  parentSha: string | null;
};

export type CommitDiff = {
  filesChanged: string[];
  additions: number;
  deletions: number;
  patch: string;
};

const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MAX_PATCH_LENGTH = 6000;
const MAX_FILE_PATCH_LENGTH = 2000;

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

  const log = await git.log({
    fs,
    dir: opts.dir,
    ref: opts.ref,
    since: opts.since,
  });

  return log
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
}

async function blobText(dir: string, oid: string | undefined): Promise<string> {
  if (!oid) return "";
  const { blob } = await git.readBlob({ fs, dir, oid });
  return Buffer.from(blob).toString("utf8");
}

function countLines(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}

/**
 * Computes the diff between a commit and its first parent (or the empty tree
 * for the root commit) by walking both trees, reading old/new blobs, and
 * emitting a bounded unified patch per changed file.
 */
export async function getCommitDiff(opts: {
  dir: string;
  commit: LocalCommit;
}): Promise<CommitDiff> {
  const { dir, commit } = opts;
  const parentTree = commit.parentSha
    ? (await git.readCommit({ fs, dir, oid: commit.parentSha })).commit.tree
    : EMPTY_TREE_OID;

  const changedFiles: { filepath: string; aOid?: string; bOid?: string }[] = [];

  await git.walk({
    fs,
    dir,
    trees: [TREE({ ref: parentTree }), TREE({ ref: commit.tree })],
    map: async (filepath, [A, B]) => {
      if (filepath === ".") return;
      const aType = A ? await A.type() : "absent";
      const bType = B ? await B.type() : "absent";
      if (aType !== "blob" && bType !== "blob") return;
      const aOid = aType === "blob" ? (A && A.oid ? await A.oid() : undefined) : undefined;
      const bOid = bType === "blob" ? (B && B.oid ? await B.oid() : undefined) : undefined;
      if (aOid !== bOid) changedFiles.push({ filepath, aOid, bOid });
    },
  });

  let additions = 0;
  let deletions = 0;
  const patches: string[] = [];

  for (const file of changedFiles) {
    const oldText = await blobText(dir, file.aOid);
    const newText = await blobText(dir, file.bOid);
    const patch = createTwoFilesPatch(
      `a/${file.filepath}`,
      `b/${file.filepath}`,
      oldText,
      newText,
    );
    const stats = countLines(patch);
    additions += stats.additions;
    deletions += stats.deletions;
    patches.push(patch.slice(0, MAX_FILE_PATCH_LENGTH));
  }

  return {
    filesChanged: changedFiles.map((f) => f.filepath),
    additions,
    deletions,
    patch: patches.join("\n").slice(0, MAX_PATCH_LENGTH),
  };
}
