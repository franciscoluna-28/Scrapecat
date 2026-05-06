import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';

export async function createProject(repository: { id: number; name: string; full_name: string }) {
  const newProject = {
    id: crypto.randomUUID(),
    name: repository.name,
    repositoryFullName: repository.full_name,
    repositoryId: repository.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [project] = await db.insert(projects).values(newProject).returning();
  return project;
}

export async function getAllProjects() {
  return await db.select().from(projects);
}

export async function getProjectById(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function getProjectByRepoId(repoId: number) {
  const [project] = await db.select().from(projects).where(eq(projects.repositoryId, repoId));
  return project;
}
