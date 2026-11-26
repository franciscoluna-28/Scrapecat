import { describe, expect, it } from "vitest";
import {
  buildDiff,
  capPatch,
  formatStat,
  hashDiff,
  isExcludedPath,
  parseNumstat,
  TOTAL_PATCH_CHARS,
  type CommitDiffFile,
} from "@/rag/git/commit-diff";

const PATCH = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,2 +1,2 @@",
  "-export const a = 1;",
  "+export const a = 2;",
  "",
  "diff --git a/src/b.ts b/src/b.ts",
  "--- a/src/b.ts",
  "+++ b/src/b.ts",
  "@@ -1,2 +1,2 @@",
  "-export const b = 1;",
  "+export const b = 3;",
].join("\n");

const FILES: CommitDiffFile[] = [
  { path: "src/a.ts", additions: 10, deletions: 5, binary: false },
  { path: "src/b.ts", additions: 2, deletions: 1, binary: false },
  { path: "assets/data.bin", additions: 0, deletions: 0, binary: true },
];

describe("commit diff helpers", () => {
  it("parses numstat, excludes lockfiles, and marks binaries", () => {
    const files = parseNumstat(
      [
        "10\t5\tsrc/a.ts",
        "-\t-\tassets/data.bin",
        "1\t0\tpnpm-lock.yaml",
        "",
      ].join("\n"),
    );

    expect(files).toEqual([
      { path: "src/a.ts", additions: 10, deletions: 5, binary: false },
      { path: "assets/data.bin", additions: 0, deletions: 0, binary: true },
    ]);
  });

  it("formats the stat and detects excluded paths", () => {
    expect(formatStat(FILES)).toContain("src/a.ts | +10 -5");
    expect(formatStat(FILES)).toContain("assets/data.bin | binary");
    expect(isExcludedPath("pnpm-lock.yaml")).toBe(true);
    expect(isExcludedPath("src/a.ts")).toBe(false);
  });

  it("caps the patch by file and total size", () => {
    const huge = `diff --git a/src/a.ts b/src/a.ts\n${"x".repeat(
      TOTAL_PATCH_CHARS * 2,
    )}`;
    const capped = capPatch(huge, FILES);

    expect(capped.truncated).toBe(true);
    expect(capped.patch.length).toBeLessThanOrEqual(
      TOTAL_PATCH_CHARS + 200,
    );
    expect(capped.patch).toContain("file diff truncated");
  });

  it("orders sections by churn and keeps the important change", () => {
    const reversed = [
      "diff --git a/src/b.ts b/src/b.ts",
      "+++ b/src/b.ts",
      "+b",
      "diff --git a/src/a.ts b/src/a.ts",
      "+++ b/src/a.ts",
      "+a",
    ].join("\n");

    const capped = capPatch(reversed, FILES);
    expect(capped.patch.indexOf("src/a.ts")).toBeLessThan(
      capped.patch.indexOf("src/b.ts"),
    );
  });

  it("hashes the exact cleaned stat + patch", () => {
    const one = hashDiff("stat", PATCH);
    const two = hashDiff("stat", PATCH);
    const other = hashDiff("stat", `${PATCH}\n+more`);

    expect(one).toBe(two);
    expect(one).not.toBe(other);
  });

  it("returns null when there is nothing summarizable", () => {
    expect(buildDiff([], PATCH)).toBeNull();
    expect(buildDiff(FILES, "")).toBeNull();
  });
});
