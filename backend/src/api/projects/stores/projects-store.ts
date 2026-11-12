import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { commitChunks, projects, type GitProvider } from "@/db/schema";

export type ProjectInput = {
  gitProvider?: GitProvider;
  providerProjectId: string;
  providerOwner: string;
  repositoryName: string;
  defaultBranch?: string;
};

export function createProjectsStore(client: DbOrTx = db) {
  return {
    async upsertProject(input: ProjectInput) {
      const gitProvider = input.gitProvider ?? "github";
      const [row] = await client
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
    },

    async listProjects() {
      return client.select().from(projects).orderBy(projects.repositoryName);
    },

    /**
     * Projects with their indexed branches in one query. The left join +
     * `array_agg` avoids the N+1 that per-project branch lookups cause.
     */
    async listProjectsWithIndexedBranches() {
      const indexedBranches = sql<string[]>`coalesce(
        array_agg(distinct ${commitChunks.branch} order by ${commitChunks.branch})
          filter (where ${commitChunks.branch} is not null),
        '{}'::text[]
      )`;

      return client
        .select({
          id: projects.id,
          gitProvider: projects.gitProvider,
          providerProjectId: projects.providerProjectId,
          providerOwner: projects.providerOwner,
          repositoryName: projects.repositoryName,
          defaultBranch: projects.defaultBranch,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          indexedBranches,
        })
        .from(projects)
        .leftJoin(commitChunks, eq(commitChunks.projectId, projects.id))
        .groupBy(projects.id)
        .orderBy(projects.repositoryName);
    },

    async listIndexedBranches(projectId: string) {
      const rows = await client
        .selectDistinct({ branch: commitChunks.branch })
        .from(commitChunks)
        .where(eq(commitChunks.projectId, projectId));
      return rows.map((row) => row.branch).filter(Boolean).sort();
    },

    async getProjectById(id: string) {
      const [row] = await client
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return row ?? null;
    },

    async getProjectByProviderId(input: {
      gitProvider: GitProvider;
      providerProjectId: string;
    }) {
      const [row] = await client
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.gitProvider, input.gitProvider),
            eq(projects.providerProjectId, input.providerProjectId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /**
     * Finds a project by its human-readable owner/repo, case-insensitively.
     * Used to reuse an existing project no matter which id format created it
     * (the external id has historically been `owner/repo` or the numeric
     * provider id). When `gitProvider` is omitted the lookup spans providers,
     * so callers with only a repo URL can recover the project's provider.
     */
    async getProjectByOwnerRepo(input: {
      gitProvider?: GitProvider;
      providerOwner: string;
      repositoryName: string;
    }) {
      const conditions = [
        sql`lower(${projects.providerOwner}) = lower(${input.providerOwner})`,
        sql`lower(${projects.repositoryName}) = lower(${input.repositoryName})`,
      ];
      if (input.gitProvider) {
        conditions.unshift(eq(projects.gitProvider, input.gitProvider));
      }
      const [row] = await client
        .select()
        .from(projects)
        .where(and(...conditions))
        .limit(1);
      return row ?? null;
    },

    async getProjectsByIds(ids: string[]) {
      if (ids.length === 0) return [];
      return client.select().from(projects).where(inArray(projects.id, ids));
    },
  };
}

export const projectsStore = createProjectsStore();
