import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { projectBranches, type ProjectBranchRow } from "@/db/schema";

export function createBranchSyncStore(client: DbOrTx = db) {
  return {
    async get(input: {
      projectId: string;
      branch: string;
    }): Promise<ProjectBranchRow | null> {
      const [row] = await client
        .select()
        .from(projectBranches)
        .where(
          and(
            eq(projectBranches.projectId, input.projectId),
            eq(projectBranches.branch, input.branch),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async markIngested(input: {
      projectId: string;
      branch: string;
      tipSha: string;
      lastCommitAt: Date | null;
    }): Promise<void> {
      await client
        .insert(projectBranches)
        .values({
          projectId: input.projectId,
          branch: input.branch,
          tipSha: input.tipSha,
          lastCommitAt: input.lastCommitAt,
        })
        .onConflictDoUpdate({
          target: [projectBranches.projectId, projectBranches.branch],
          set: {
            tipSha: sql`excluded.tip_sha`,
            lastCommitAt: sql`coalesce(excluded.last_commit_at, ${projectBranches.lastCommitAt})`,
            lastIngestedAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });
    },
  };
}

export const branchSyncStore = createBranchSyncStore();
