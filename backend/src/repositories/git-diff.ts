import fs from "node:fs";
import { walk, TREE } from "isomorphic-git";
import { diffLines } from "diff";

export type FileChangeStatus = "added" | "deleted" | "modified";

export type FileChange = {
  filepath: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
};

export type CommitDiffStats = {
  filesChanged: number;
  additions: number;
  deletions: number;
  files: FileChange[];
};

/**
 * The git empty tree object. Diffing a root commit (no parent) against this
 * yields every file as added. isomorphic-git's `TREE({ ref: null })` throws,
 * so we resolve the empty tree by its well-known SHA instead.
 */
const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function decode(buf: Uint8Array): string {
  return new TextDecoder().decode(buf);
}

function isBinary(buf: Uint8Array): boolean {
  return buf.length > 0 && buf.subarray(0, 8000).includes(0);
}

function countLines(buf: Uint8Array | undefined): number {
  if (!buf || isBinary(buf)) return 0;
  const text = decode(buf);
  if (text.length === 0) return 0;
  return text.split("\n").length - 1;
}

function countDiffLines(
  oldText: string,
  newText: string,
): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const part of diffLines(oldText, newText)) {
    if (part.added) additions += part.count ?? 0;
    else if (part.removed) deletions += part.count ?? 0;
  }
  return { additions, deletions };
}

type WalkEntry = {
  type(): Promise<string>;
  oid(): Promise<string>;
  content(): Promise<Uint8Array | void>;
};

async function entryContent(entry: WalkEntry | null | undefined): Promise<Uint8Array | undefined> {
  const buf = await entry?.content();
  return buf ?? undefined;
}

/**
 * Computes file-level diff stats between `commitSha` and its parent by walking
 * both trees in the local archive. Never touches the network — the clone is
 * the source of truth. Only the changed blobs are read (for line counts), so
 * the cost is bounded by the diff size, not repo size.
 *
 * Binary files are counted as changed files but contribute 0 lines.
 */
export async function getCommitDiffStats(opts: {
  dir: string;
  parentSha: string | null;
  commitSha: string;
}): Promise<CommitDiffStats> {
  const { dir, parentSha, commitSha } = opts;
  const trees = [
    TREE({ ref: parentSha ?? EMPTY_TREE_SHA }),
    TREE({ ref: commitSha }),
  ];

  const changes = await walk({
    fs,
    dir,
    trees,
    map: async (filepath, [oldEntry, newEntry]) => {
      if (filepath === ".") return;
      const oldType = oldEntry ? await oldEntry.type() : null;
      const newType = newEntry ? await newEntry.type() : null;
      if (oldType === "tree" || newType === "tree") return;

      const oldOid = oldEntry ? await oldEntry.oid() : null;
      const newOid = newEntry ? await newEntry.oid() : null;

      let status: FileChangeStatus | null = null;
      if (!oldOid) status = "added";
      else if (!newOid) status = "deleted";
      else if (oldOid !== newOid) status = "modified";
      if (!status) return;

      let additions = 0;
      let deletions = 0;
      if (status === "added") {
        additions = countLines(await entryContent(newEntry));
      } else if (status === "deleted") {
        deletions = countLines(await entryContent(oldEntry));
      } else {
        const oldBuf = await entryContent(oldEntry);
        const newBuf = await entryContent(newEntry);
        if (oldBuf && newBuf && !isBinary(oldBuf) && !isBinary(newBuf)) {
          ({ additions, deletions } = countDiffLines(decode(oldBuf), decode(newBuf)));
        }
      }

      return { filepath, status, additions, deletions };
    },
  });

  const files = (changes as (FileChange | undefined)[]).filter(
    (c): c is FileChange => c !== undefined,
  );
  return {
    filesChanged: files.length,
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    files,
  };
}
