import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { githubProjects } from "@/db/schema";

export type ProjectInput = {
  githubProjectId: number;
  repositoryName: string;
  defaultBranch?: string;
};

export async function upsertProject(input: ProjectInput) {
  const [row] = await db
    .insert(githubProjects)
    .values({
      githubProjectId: input.githubProjectId,
      repositoryName: input.repositoryName,
      defaultBranch: input.defaultBranch ?? "main",
    })
    .onConflictDoUpdate({
      target: githubProjects.githubProjectId,
      set: {
        repositoryName: input.repositoryName,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listProjects() {
  return db.select().from(githubProjects).orderBy(githubProjects.repositoryName);
}

export async function getProjectById(id: string) {
  const [row] = await db
    .select()
    .from(githubProjects)
    .where(eq(githubProjects.id, id))
    .limit(1);
  return row ?? null;
}

export async function getProjectByGithubId(githubProjectId: number) {
  const [row] = await db
    .select()
    .from(githubProjects)
    .where(eq(githubProjects.githubProjectId, githubProjectId))
    .limit(1);
  return row ?? null;
}

export async function getProjectsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(githubProjects).where(inArray(githubProjects.id, ids));
}
