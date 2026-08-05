import { eq, inArray } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { githubProjects } from "@/db/schema";

export type ProjectInput = {
  githubProjectId: number;
  githubOwner: string;
  repositoryName: string;
  defaultBranch?: string;
};

export async function upsertProject({
  input, 
  tx
}: {
  input: ProjectInput;
  tx?: Tx;
}) {
  const [row] = await (tx || db)
    .insert(githubProjects)
    .values({
      githubProjectId: input.githubProjectId,
      githubOwner: input.githubOwner,
      repositoryName: input.repositoryName,
      defaultBranch: input.defaultBranch ?? "main",
    })
    .onConflictDoUpdate({
      target: githubProjects.githubProjectId,
      set: {
        githubOwner: input.githubOwner,
        repositoryName: input.repositoryName,
        updatedAt: new Date(),
      },
    })
    .returning();

  // On a fresh insert both columns get the same now(); on an update only
  // updatedAt is bumped, so equality reliably means the row was created.
  const created = row.createdAt.getTime() === row.updatedAt.getTime();
  return { project: row, created };
}

export async function listProjects(opts?: { tx?: DbOrTx }) {
  const client = opts?.tx || db;
  return client
    .select()
    .from(githubProjects)
    .orderBy(githubProjects.repositoryName);
}

export async function getProjectById({
  id,
  tx,
}: {
  id: string;
  tx?: DbOrTx;
}) {
  const [row] = await (tx || db)
    .select()
    .from(githubProjects)
    .where(eq(githubProjects.id, id))
    .limit(1);

  return row ?? null;
}

export async function getProjectByGithubId({
  githubProjectId,
  tx
}: {
  githubProjectId: number,
  tx?: DbOrTx
}) {
  const client = tx || db;
  const [row] = await client
    .select()
    .from(githubProjects)
    .where(eq(githubProjects.githubProjectId, githubProjectId))
    .limit(1);
  return row ?? null;
}

export async function getProjectsByIds({
  ids,
  tx
}: {
  ids: string[],
  tx?: DbOrTx
}) {
  if (ids.length === 0) return [];
  const client = tx || db;
  return client.select().from(githubProjects).where(inArray(githubProjects.id, ids));
}
