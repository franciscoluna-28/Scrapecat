/**
 * In demo mode, ingestion is bounded to the trunk branches so a single visit
 * can't trigger a crawl across every feature branch. If a repo has neither
 * `main` nor `master`, fall back to its resolved default branch (one branch).
 */
export const DEMO_TRUNK_BRANCHES = ["main", "master"] as const;

function isTrunk(branch: string): boolean {
  return (DEMO_TRUNK_BRANCHES as readonly string[]).includes(branch);
}

/** The branch list to expose in demo mode (trunk branches, or the default). */
export function restrictDemoBranches(branches: string[], defaultBranch: string): string[] {
  const trunk = branches.filter(isTrunk);
  return trunk.length > 0 ? trunk : [defaultBranch];
}

/** Whether a branch may be ingested in demo mode. */
export function isDemoBranchAllowed(branch: string, defaultBranch: string): boolean {
  return isTrunk(branch) || branch === defaultBranch;
}
