import { and, eq, inArray, sql } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { projects, type GitProvider } from "@/db/schema";
import { commitChunks } from "@/db/schema";

export type ProjectInput = {
  gitProvider?: GitProvider;
  providerProjectId: string;
  providerOwner: string;
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
  const gitProvider = input.gitProvider ?? "github";
  const [row] = await (tx || db)
    .insert(projects)
    .values({
      gitProvider,
      providerProjectId: input.providerProjectId,
      providerOwner: input.providerOwner,
      repositoryName: input.repositoryName,
      defaultBranch: input.defaultBranch ?? "main",
    })
    .onConflictDoUpdate({
      target: [projects.gitProvider, projects.providerProjectId],
      set: {
        providerOwner: input.providerOwner,
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
    .from(projects)
    .orderBy(projects.repositoryName);
}

export async function listIndexedBranches(projectId: string, tx?: DbOrTx) {
  const client = tx || db;
  const rows = await client
    .selectDistinct({ branch: commitChunks.branch })
    .from(commitChunks)
    .where(eq(commitChunks.projectId, projectId));
  return rows.map((row) => row.branch).filter(Boolean).sort();
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
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  return row ?? null;
}

export async function getProjectByProviderId({
  gitProvider,
  providerProjectId,
  tx,
}: {
  gitProvider: GitProvider;
  providerProjectId: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const [row] = await client
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.gitProvider, gitProvider),
        eq(projects.providerProjectId, providerProjectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Finds a project by its human-readable owner/repo, case-insensitively. Used to
 * reuse an existing project no matter which id format created it (the external
 * id has historically been `owner/repo` or the numeric provider id).
 */
export async function getProjectByOwnerRepo({
  gitProvider,
  providerOwner,
  repositoryName,
  tx,
}: {
  gitProvider: GitProvider;
  providerOwner: string;
  repositoryName: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const [row] = await client
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.gitProvider, gitProvider),
        sql`lower(${projects.providerOwner}) = lower(${providerOwner})`,
        sql`lower(${projects.repositoryName}) = lower(${repositoryName})`,
      ),
    )
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
  return client.select().from(projects).where(inArray(projects.id, ids));
}
