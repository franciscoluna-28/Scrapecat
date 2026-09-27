// @ts-nocheck - This script is a build-time utility and not part of the runtime codebase. It uses Node.js APIs and Git commands that are not type-checked against the project's TypeScript configuration.

/**
 * 
 * Build-time generator for the demo's pre-loaded commit datasets.
 *
 * For each repo in DEMO_REPOS (default: formbricks + shadcn-ui/ui) it does a
 * shallow, blob-less clone (trees only — no file contents), reads the ~500 most
 * recent commits + their changed-file scope, and writes a JSON snapshot under
 * `src/demo/data/{owner}__{repo}.json`. The snapshot is bundled into the
 * function and seeded into the in-memory store at boot, so the demo repos are
 * "already loaded" with zero runtime git/network.
 *
 * Runs in the deploy/build environment (Vercel build containers ship git).
 * A snapshot of each repo is also committed so local dev works without running
 * this script first.
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileP = promisify(execFile);

// Keep in sync with src/demo/seed.ts imports.
const DEFAULT_REPOS = [
  { owner: "formbricks", repo: "formbricks" },
  { owner: "shadcn-ui", repo: "ui" },
  { owner: "franciscoluna-28", repo: "Scrapecat" },
];

const DATA_DIR = path.resolve(process.cwd(), "src/demo/data");
const MAX_COMMITS = 500;
const LOG_FORMAT = "%H%x1f%an%x1f%at%x1f%P%x1f%B";

function parseDemoRepos(): { owner: string; repo: string }[] {
  const raw = process.env.DEMO_REPOS;
  if (!raw) return DEFAULT_REPOS;
  try {
    const parsed = JSON.parse(raw) as { owner?: string; repo?: string }[];
    const repos = parsed
      .filter((r) => r && r.owner && r.repo)
      .map((r) => ({ owner: r.owner!, repo: r.repo! }));
    if (repos.length === 0) return DEFAULT_REPOS;
    return repos;
  } catch {
    console.warn("DEMO_REPOS is not valid JSON — using defaults.");
    return DEFAULT_REPOS;
  }
}

function authArgs(token?: string): string[] {
  if (!token) return [];
  const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
  return ["-c", `http.extraheader=AUTHORIZATION: basic ${encoded}`];
}

async function getDefaultBranch(owner: string, repo: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) throw new Error(`Failed to read repo metadata: ${res.status}`);
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? "main";
}

async function cloneRepo(opts: { owner: string; repo: string; branch: string; dir: string; token?: string }) {
  const { owner, repo, branch, dir, token } = opts;
  const url = `https://github.com/${owner}/${repo}.git`;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  await execFileP("git", [
    ...authArgs(token),
    "clone",
    "--filter=blob:none",
    "--single-branch",
    "--branch",
    branch,
    "--no-checkout",
    `--depth=${MAX_COMMITS}`,
    url,
    dir,
  ]);
}

type LoggedCommit = {
  sha: string;
  author: string;
  date: string;
  parentSha: string | null;
  message: string;
};

async function listCommits(dir: string, ref: string): Promise<LoggedCommit[]> {
  const { stdout } = await execFileP("git", [
    "-C",
    dir,
    "log",
    `--max-count=${MAX_COMMITS}`,
    "--pretty=format:" + LOG_FORMAT,
    `--date=unix`,
    ref,
  ]);
  const commits: LoggedCommit[] = [];
  // Format has no -z; records are newline separated, fields are \x1f. Messages
  // may contain newlines, so split records by a sentinel: parse field-wise.
  const records = stdout.split("\n");
  for (let i = 0; i < records.length; i++) {
    // A record may span multiple lines if the message is multi-line; the next
    // record boundary is a line that starts with a 40-char hex sha.
    const line = records[i];
    if (!line || !/^[0-9a-f]{40}\x1f/.test(line)) continue;
    const [sha, author, at, parents, ...msgParts] = line.split("\x1f");
    let message = msgParts.join("\x1f").trim();
    // Grab subsequent non-sha lines as continuation of the message body.
    while (i + 1 < records.length && !/^[0-9a-f]{40}\x1f/.test(records[i + 1])) {
      i += 1;
      message = `${message}\n${records[i]}`.trim();
    }
    commits.push({
      sha,
      author: author || "",
      date: new Date(Number(at) * 1000).toISOString(),
      parentSha: parents?.split(" ")[0] || null,
      message,
    });
  }
  return commits;
}

type FileChange = { filepath: string; status: string };

async function changedFiles(dir: string, commit: LoggedCommit): Promise<FileChange[]> {
  const args = [
    "-C",
    dir,
    "-c",
    "core.quotepath=false",
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "-z",
    "-r",
  ];
  if (commit.parentSha) args.push(commit.parentSha, commit.sha);
  else args.push("--root", commit.sha);
  const { stdout } = await execFileP("git", args);
  const tokens = stdout.split("\0");
  const files: FileChange[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const status = tokens[i];
    const filepath = tokens[i + 1];
    if (!status || !filepath) continue;
    files.push({ filepath, status });
  }
  return files;
}

async function buildSnapshot(opts: { owner: string; repo: string; token?: string }) {
  const { owner, repo, token } = opts;
  console.log(`— ${owner}/${repo}`);

  const branch = await getDefaultBranch(owner, repo, token);
  const dir = path.join(process.cwd(), ".tmp-demo-data", `${owner}__${repo}`);
  await cloneRepo({ owner, repo, branch, dir, token });

  const commits = await listCommits(dir, branch);
  console.log(`  branch=${branch} commits=${commits.length}`);

  const chunks: {
    commitSha: string;
    commitMessage: string;
    author: string | null;
    committedAt: string;
    metadata: { filesChanged: string[]; commitUrl: string };
  }[] = [];

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    let filesChanged: string[] = [];
    try {
      filesChanged = (await changedFiles(dir, c)).map((f) => f.filepath);
    } catch {
      // Shallow boundary commit — parent trees are absent. Keep going.
    }
    chunks.push({
      commitSha: c.sha,
      commitMessage: c.message,
      author: c.author || null,
      committedAt: c.date,
      metadata: {
        filesChanged,
        commitUrl: `https://github.com/${owner}/${repo}/commit/${c.sha}`,
      },
    });
  }

  await fs.rm(dir, { recursive: true, force: true });
  await fs.rm(path.join(process.cwd(), ".tmp-demo-data"), { recursive: true, force: true });

  const snapshot = {
    provider: "github",
    owner,
    repo,
    defaultBranch: branch,
    commits: chunks,
  };

  const outFile = path.join(DATA_DIR, `${owner}__${repo}.json`);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(snapshot, null, 2));
  console.log(`  → ${path.relative(process.cwd(), outFile)} (${(await fs.stat(outFile)).size} bytes)`);
}

async function main() {
  const repos = parseDemoRepos();
  const token = process.env.GITHUB_TOKEN;
  console.log(`Building demo data for ${repos.length} repo(s)...`);
  for (const r of repos) {
    try {
      await buildSnapshot({ ...r, token });
    } catch (error) {
      console.error(`  ✗ failed for ${r.owner}/${r.repo}: ${(error as Error).message}`);
    }
  }
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);