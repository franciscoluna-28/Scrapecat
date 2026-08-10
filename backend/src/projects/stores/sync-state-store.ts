import { and, eq, sql } from "drizzle-orm";
import { db, DbOrTx } from "@/db/client";
import { projectSyncState } from "@/db/schema";

export type SyncState = {
  projectId: string;
  branch: string;
  lastSyncedCommitSha: string;
  lastSyncedAt: Date;
};

export async function getSyncState({
  projectId,
  branch,
  tx,
}: {
  projectId: string;
  branch: string;
  tx?: DbOrTx;
}): Promise<SyncState | null> {
  const client = tx || db;
  const [row] = await client
    .select()
    .from(projectSyncState)
    .where(
      and(
        eq(projectSyncState.projectId, projectId),
        eq(projectSyncState.branch, branch),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertSyncState({
  projectId,
  branch,
  lastSyncedCommitSha,
  lastSyncedAt,
  tx,
}: SyncState & { tx?: DbOrTx }): Promise<void> {
  const client = tx || db;
  await client
    .insert(projectSyncState)
    .values({ projectId, branch, lastSyncedCommitSha, lastSyncedAt })
    .onConflictDoUpdate({
      target: [projectSyncState.projectId, projectSyncState.branch],
      set: {
        lastSyncedCommitSha,
        lastSyncedAt,
        updatedAt: sql`now()`,
      },
    });
}
