import path from "node:path";
import { createHash } from "node:crypto";

const SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Patterns shared by route schemas and runtime path checks. */
export const OWNER_PATTERN =
  "^(?!.*\\.\\.)(?!.*\\\\)(?!.*//)(?!/)(?!.*/$)[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$";
export const REPO_PATTERN = "^(?!.*\\.\\.)(?!.*\\\\)[A-Za-z0-9._-]+$";
export const BRANCH_PATTERN =
  "^(?!.*\\.\\.)(?!.*\\\\)(?!.*//)(?!/)(?!.*/$)[A-Za-z0-9._/-]+$";
export const PROVIDER_PROJECT_ID_PATTERN =
  "^(?!.*\\.\\.)(?!.*\\\\)[A-Za-z0-9._/-]+$";

export function assertSafePathValue(
  value: string,
  label: string,
  opts: { allowSlash?: boolean; maxLength?: number } = {},
): void {
  const { allowSlash = true, maxLength = 200 } = opts;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    path.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }

  const segments = value.split("/");
  if (!allowSlash && segments.length !== 1) {
    throw new Error(`Invalid ${label}`);
  }
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !SEGMENT.test(segment),
    )
  ) {
    throw new Error(`Invalid ${label}`);
  }
}

/**
 * Resolves `owner/repo/branch` under `base`, rejecting anything that escapes.
 * Absolute paths and `..` segments are not resolved into a target path.
 */
export function resolveInside(
  base: string,
  owner: string,
  repo: string,
  branch: string,
): string {
  assertSafePathValue(owner, "owner");
  assertSafePathValue(repo, "repository", { allowSlash: false, maxLength: 100 });
  assertSafePathValue(branch, "branch");

  const root = path.resolve(base);
  const resolved = path.resolve(root, owner, repo, branch);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid archive path");
  }
  return resolved;
}

/** Stable, filesystem-safe directory name for a job id. */
export function safeJobDirName(jobId: string): string {
  return createHash("sha256").update(jobId).digest("hex");
}
