import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { commitChunks, projects } from "@/db/schema";
import {
  commitChunksStore,
  type CommitChunkInput,
} from "@/projects/stores/commit-chunks-store";
import { projectsStore } from "@/projects/stores/projects-store";

const enabled = process.env.DB_INTEGRATION === "1";
const SPACE_A = { provider: "openrouter", model: "model-a" };
const SPACE_B = { provider: "openrouter", model: "model-b" };
const VECTOR = Array.from({ length: 768 }, () => 0.1);

describe.skipIf(!enabled)("commit chunk embedding space", () => {
  let projectId: string | null = null;

  afterEach(async () => {
    if (projectId) {
      await db.delete(projects).where(eq(projects.id, projectId));
      projectId = null;
    }
  });

  it("only treats current-model embeddings as pending or searchable", async () => {
    const { project } = await projectsStore.upsertProject({
      providerProjectId: randomUUID(),
      providerOwner: "owner",
      repositoryName: `repo-${randomUUID()}`,
      defaultBranch: "main",
    });
    projectId = project.id;

    await upsertChunks([
      {
        projectId,
        commitSha: "sha-1",
        branch: "main",
        commitMessage: "first",
        committedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        projectId,
        commitSha: "sha-2",
        branch: "main",
        commitMessage: "second",
        committedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const rows = await db
      .select({
        id: commitChunks.id,
        contentHash: commitChunks.contentHash,
      })
      .from(commitChunks)
      .where(eq(commitChunks.projectId, projectId));

    expect(await commitChunksStore.listPendingChunks(projectId, SPACE_A)).toHaveLength(2);

    await commitChunksStore.updateChunkEmbeddings({
      updates: rows.map((row) => ({
        id: row.id,
        embedding: VECTOR,
        contentHash: row.contentHash ?? "",
      })),
      space: SPACE_A,
    });

    expect(await commitChunksStore.listPendingChunks(projectId, SPACE_A)).toHaveLength(0);
    expect(await commitChunksStore.listPendingChunks(projectId, SPACE_B)).toHaveLength(2);
    expect(
      await commitChunksStore.countChunksForProject({
        projectId,
        embeddingSpace: SPACE_A,
      }),
    ).toBe(2);
    expect(
      await commitChunksStore.countChunksForProject({
        projectId,
        embeddingSpace: SPACE_B,
      }),
    ).toBe(0);
    expect(await semantic(projectId, SPACE_A)).toHaveLength(2);
    expect(await semantic(projectId, SPACE_B)).toHaveLength(0);

    await upsertChunks([
      {
        projectId,
        commitSha: "sha-1",
        branch: "main",
        commitMessage: "first updated",
        committedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    expect(await commitChunksStore.listPendingChunks(projectId, SPACE_A)).toHaveLength(1);
    expect(
      await commitChunksStore.countChunksForProject({
        projectId,
        embeddingSpace: SPACE_A,
      }),
    ).toBe(1);
    expect(await semantic(projectId, SPACE_A)).toHaveLength(1);
  });

  async function upsertChunks(inputs: CommitChunkInput[]) {
    await commitChunksStore.upsertCommitChunks(inputs);
  }

  async function semantic(
    projectId: string,
    embeddingSpace: { provider: string; model: string },
  ) {
    return commitChunksStore.semanticSearchCommits({
      projectId,
      embedding: VECTOR,
      embeddingSpace,
      limit: 10,
    });
  }
});
