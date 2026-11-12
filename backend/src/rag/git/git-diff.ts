import { runGit } from "@/rag/git/git";

export type FileChangeStatus = "added" | "deleted" | "modified";

export type FileChange = {
  filepath: string;
  status: FileChangeStatus;
};

export type CommitChangedStats = {
  filesChanged: number;
  files: FileChange[];
};

const STATUS_MAP: Record<string, FileChangeStatus> = {
  A: "added",
  D: "deleted",
};

const DIFF_ARGS = [
  "--no-pager",
  "-c",
  "core.quotepath=false",
  "diff-tree",
  "--name-status",
  "--no-renames",
  "-z",
  "-r",
];

const COMMIT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

function parseChanges(tokens: string[]): FileChange[] {
  const files: FileChange[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const status = tokens[i];
    const filepath = tokens[i + 1];
    if (!status || !filepath) continue;
    files.push({ filepath, status: STATUS_MAP[status] ?? "modified" });
  }
  return files;
}

/**
 * Lists the files changed by `commitSha` by asking the native git binary to
 * diff its tree against its parent's. The heavy work happens in git's own C
 * process, so it uses ~0 Node.js RAM and never blocks the event loop.
 *
 * - Non-root commits: two-arg `diff-tree <parent> <sha>` so merge commits diff
 *   against their first parent (the one-arg form silently skips merges).
 * - Root commits: `--root` diffs against the empty tree (every file added).
 */
export async function getCommitChangedFiles(opts: {
  dir: string;
  parentSha: string | null;
  commitSha: string;
}): Promise<CommitChangedStats> {
  const { dir, parentSha, commitSha } = opts;

  const args = [...DIFF_ARGS, "--no-commit-id"];
  if (parentSha) {
    args.push(parentSha, commitSha);
  } else {
    args.push("--root", commitSha);
  }

  const stdout = await runGit({ cwd: dir, args, label: "git diff-tree" });
  const files = parseChanges(stdout.split("\0"));
  return { filesChanged: files.length, files };
}

/**
 * Batched variant for indexing: one `git diff-tree --stdin` process for a whole
 * batch instead of one process per commit. `-m` makes merge commits show their
 * first-parent diff; repeated sections for the same commit are ignored.
 */
export async function getCommitsChangedFiles(opts: {
  dir: string;
  shas: string[];
}): Promise<Map<string, CommitChangedStats>> {
  const { dir, shas } = opts;
  const result = new Map<string, CommitChangedStats>();
  for (const sha of shas) {
    result.set(sha, { filesChanged: 0, files: [] });
  }
  if (shas.length === 0) return result;

  const stdout = await runGit({
    cwd: dir,
    args: [...DIFF_ARGS, "--stdin", "--root", "-m"],
    input: `${shas.join("\n")}\n`,
    label: "git diff-tree --stdin",
  });

  const tokens = stdout.split("\0");
  const seenSections = new Set<string>();
  let current: CommitChangedStats | null = null;

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (!token) {
      i += 1;
      continue;
    }

    if (COMMIT_ID.test(token)) {
      i += 1;
      if (seenSections.has(token)) {
        // Merge commits emit one section per parent; keep the first.
        current = null;
      } else {
        seenSections.add(token);
        current = result.get(token) ?? null;
      }
      continue;
    }

    const filepath = tokens[i + 1] ?? "";
    i += 2;
    if (current && filepath) {
      current.files.push({ filepath, status: STATUS_MAP[token] ?? "modified" });
      current.filesChanged = current.files.length;
    }
  }

  return result;
}
