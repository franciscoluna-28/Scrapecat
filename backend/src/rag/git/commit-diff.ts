import { createHash } from "node:crypto";

export type CommitDiffFile = {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
};

export type CommitDiff = {
  stat: string;
  patch: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  binaryFiles: number;
  truncated: boolean;
  hash: string;
};

export const PER_FILE_PATCH_CHARS = 4_000;
export const TOTAL_PATCH_CHARS = 12_000;

const EXCLUDED_PATHS = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/,
  /(^|\/)(dist|build|out|vendor|node_modules|\.next|coverage)\//,
  /\.(min\.js|min\.css|map|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|tar|gz|mp4|mov|webm|wasm)$/i,
];

/** Pathspecs passed to git so excluded files never enter the diff. */
export const DIFF_PATHSPECS = [
  ".",
  ":(exclude)pnpm-lock.yaml",
  ":(exclude)**/pnpm-lock.yaml",
  ":(exclude)package-lock.json",
  ":(exclude)**/package-lock.json",
  ":(exclude)yarn.lock",
  ":(exclude)**/yarn.lock",
  ":(exclude)bun.lockb",
  ":(exclude)**/bun.lockb",
  ":(exclude)Cargo.lock",
  ":(exclude)**/Cargo.lock",
  ":(exclude)poetry.lock",
  ":(exclude)**/poetry.lock",
  ":(exclude)Gemfile.lock",
  ":(exclude)**/Gemfile.lock",
  ":(exclude)composer.lock",
  ":(exclude)**/composer.lock",
  ":(exclude)dist/**",
  ":(exclude)**/dist/**",
  ":(exclude)build/**",
  ":(exclude)**/build/**",
  ":(exclude)out/**",
  ":(exclude)**/out/**",
  ":(exclude)vendor/**",
  ":(exclude)**/vendor/**",
  ":(exclude)node_modules/**",
  ":(exclude)**/node_modules/**",
  ":(exclude).next/**",
  ":(exclude)**/.next/**",
  ":(exclude)coverage/**",
  ":(exclude)**/coverage/**",
  ":(exclude)**/*.min.js",
  ":(exclude)**/*.min.css",
  ":(exclude)**/*.map",
  ":(exclude)**/*.png",
  ":(exclude)**/*.jpg",
  ":(exclude)**/*.jpeg",
  ":(exclude)**/*.gif",
  ":(exclude)**/*.webp",
  ":(exclude)**/*.ico",
  ":(exclude)**/*.woff",
  ":(exclude)**/*.woff2",
  ":(exclude)**/*.ttf",
  ":(exclude)**/*.eot",
  ":(exclude)**/*.pdf",
  ":(exclude)**/*.zip",
  ":(exclude)**/*.tar",
  ":(exclude)**/*.gz",
  ":(exclude)**/*.mp4",
  ":(exclude)**/*.mov",
  ":(exclude)**/*.webm",
  ":(exclude)**/*.wasm",
];

export function isExcludedPath(filepath: string): boolean {
  const normalized = filepath.replace(/\\/g, "/");
  return EXCLUDED_PATHS.some((pattern) => pattern.test(normalized));
}

/** Parses `git diff --numstat` output; binary files report `-`/`-`. */
export function parseNumstat(stdout: string): CommitDiffFile[] {
  const files: CommitDiffFile[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [added, deleted, ...pathParts] = line.split("\t");
    const filepath = pathParts.join("\t");
    if (!filepath || isExcludedPath(filepath)) continue;
    const binary = added === "-" || deleted === "-";
    files.push({
      path: filepath,
      additions: binary ? 0 : Number(added) || 0,
      deletions: binary ? 0 : Number(deleted) || 0,
      binary,
    });
  }
  return files;
}

export function formatStat(files: CommitDiffFile[]): string {
  return files
    .map((file) =>
      file.binary
        ? `${file.path} | binary`
        : `${file.path} | +${file.additions} -${file.deletions}`,
    )
    .join("\n");
}

function patchPath(section: string): string {
  const match = section.match(/^diff --git a\/(.+?) b\/(.+)$/m);
  return match?.[2] ?? "";
}

/**
 * Caps each file section and the whole patch. Sections are ordered by churn so
 * the meaningful changes survive the budget.
 */
export function capPatch(
  patch: string,
  files: CommitDiffFile[],
): { patch: string; truncated: boolean } {
  const churn = new Map(
    files.map((file) => [file.path, file.additions + file.deletions]),
  );
  const sections = patch
    .split(/^(?=diff --git )/m)
    .map((section) => section.trimEnd())
    .filter(Boolean)
    .map((section) => ({
      section,
      churn: churn.get(patchPath(section)) ?? 0,
    }))
    .sort((a, b) => b.churn - a.churn);

  if (sections.length === 0) {
    const capped = patch.slice(0, TOTAL_PATCH_CHARS);
    return {
      patch: capped,
      truncated: capped.length < patch.length,
    };
  }

  const output: string[] = [];
  let used = 0;
  let truncated = false;

  for (const { section } of sections) {
    if (used >= TOTAL_PATCH_CHARS) {
      truncated = true;
      break;
    }
    const remaining = TOTAL_PATCH_CHARS - used;
    const budget = Math.min(PER_FILE_PATCH_CHARS, remaining);
    let piece = section;
    if (piece.length > budget) {
      piece = `${piece.slice(0, budget)}\n... [file diff truncated]`;
      truncated = true;
    }
    output.push(piece);
    used += piece.length;
  }

  if (truncated) {
    output.push("... [remaining diffs omitted; see stat]");
  }

  return { patch: output.join("\n\n"), truncated };
}

export function hashDiff(stat: string, patch: string): string {
  return createHash("sha256").update(`${stat}\n\n${patch}`).digest("hex");
}

export function buildDiff(
  files: CommitDiffFile[],
  rawPatch: string,
): CommitDiff | null {
  if (files.length === 0) return null;
  const stat = formatStat(files);
  const capped = capPatch(rawPatch, files);
  if (!capped.patch.trim()) return null;

  return {
    stat,
    patch: capped.patch,
    filesChanged: files.map((file) => file.path),
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    binaryFiles: files.filter((file) => file.binary).length,
    truncated: capped.truncated,
    hash: hashDiff(stat, capped.patch),
  };
}
