import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, commitChunks } from "@/db/schema";
import * as projectsStore from "@/projects/stores/projects-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import * as reportsStore from "@/reports/stores/reports-store";
import * as reportCommitsStore from "@/reports/stores/report-commits-store";
import * as credentialsStore from "@/credentials/stores/credentials-store";
import { buildApp } from "@/app";
import { embedNewChunks } from "@/projects/embed-chunks";

vi.mock("@/projects/embeddings", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1536 }, () => 0)),
  ),
}));

const enabled = process.env.DB_INTEGRATION === "1";

describe.runIf(enabled)("postgres integration (set DB_INTEGRATION=1)", () => {
  const providerProjectId = 999_999_001;
  const chunkProjectId = 999_999_002;
  const legacyProjectId = 999_999_003;
  const embedProjectId = 999_999_004;
  const repositoryName = "integration-test-repo";

  const cleanupProject = async (id: number) => {
    const project = await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId: id });
    if (project) {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  };

  const cleanupCredential = async () => {
    const existing = await credentialsStore.listCredentials();
    for (const c of existing) {
      if (c.keyHint === "sk-test-hint") {
        await credentialsStore.deleteCredentialById(c.id);
      }
    }
  };

  beforeAll(async () => {
    await cleanupProject(providerProjectId);
    await cleanupProject(chunkProjectId);
    await cleanupProject(legacyProjectId);
    await cleanupProject(embedProjectId);
    await cleanupCredential();
  });

  afterAll(async () => {
    await cleanupProject(providerProjectId);
    await cleanupProject(chunkProjectId);
    await cleanupProject(legacyProjectId);
    await cleanupProject(embedProjectId);
    await cleanupCredential();
  });

  it("projects-store upserts idempotently and lists", async () => {
    const { project: p } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName, defaultBranch: "main" },
    });
    expect(p.repositoryName).toBe(repositoryName);
    expect(p.defaultBranch).toBe("main");

    const { project: p2 } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName: `${repositoryName}-v2` },
    });
    expect(p2.id).toBe(p.id);
    expect(p2.repositoryName).toBe(`${repositoryName}-v2`);

    const all = await projectsStore.listProjects();
    expect(all.some((x) => x.providerProjectId === providerProjectId)).toBe(true);
  });

  it("commit-chunks-store upserts with dedupe and filters by date range", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName },
    });
    const chunk = {
      projectId: project.id,
      commitSha: "abc123",
      commitMessage: "feat: integration test",
      author: "tester",
      diffSummary: "diff summary for integration test",
      metadata: { additions: 5, deletions: 2, filesChanged: ["src/a.ts"] },
      committedAt: new Date("2026-01-10T00:00:00Z"),
    };
    await commitChunksStore.upsertCommitChunks({ inputs: [chunk] });
    await commitChunksStore.upsertCommitChunks({ inputs: [chunk] });

    const all = await commitChunksStore.listCommitsForProject({ projectId: project.id });
    expect(all.filter((c) => c.commitSha === "abc123")).toHaveLength(1);
    expect(all[0].diffSummary).toBe("diff summary for integration test");

    const inRange = await commitChunksStore.listCommitsForProject({
      projectId: project.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    });
    expect(inRange.some((c) => c.commitSha === "abc123")).toBe(true);

    const outOfRange = await commitChunksStore.listCommitsForProject({
      projectId: project.id,
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-01-31"),
    });
    expect(outOfRange.filter((c) => c.commitSha === "abc123")).toHaveLength(0);
  });

  it("getChunksByShas returns stored shas and sets content_hash on upsert", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId: chunkProjectId, providerOwner: "test-owner", repositoryName },
    });
    await commitChunksStore.upsertCommitChunks({
      inputs: [
        {
          projectId: project.id,
          commitSha: "sha-1",
          commitMessage: "feat: first",
          author: "tester",
          diffSummary: "first summary",
          metadata: { commitUrl: "https://github.com/org/repo/commit/sha-1" },
          committedAt: new Date("2026-02-01T00:00:00Z"),
        },
      ],
    });

    const found = await commitChunksStore.getChunksByShas({
      projectId: project.id,
      shas: ["sha-1", "sha-missing"],
    });
    expect(found.has("sha-1")).toBe(true);
    expect(found.get("sha-1")?.contentHash).toBe(commitChunksStore.contentHashOf("first summary"));
    expect(found.has("sha-missing")).toBe(false);
  });

  it("embedding pipeline embeds pending chunks and is idempotent", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId: embedProjectId, providerOwner: "test-owner", repositoryName },
    });
    await commitChunksStore.upsertCommitChunks({
      inputs: [
        {
          projectId: project.id,
          commitSha: "embed-abc",
          commitMessage: "feat: embeddings",
          author: "tester",
          diffSummary: "embedding corpus text",
          metadata: {},
          committedAt: new Date("2026-02-02T00:00:00Z"),
        },
      ],
    });

    const first = await embedNewChunks(project.id);
    expect(first.embedded).toBe(1);

    const rows = await db
      .select()
      .from(commitChunks)
      .where(eq(commitChunks.commitSha, "embed-abc"));
    expect(rows[0].embeddingHash).toBe(commitChunksStore.contentHashOf("embedding corpus text"));
    expect(rows[0].contentHash).toBe(commitChunksStore.contentHashOf("embedding corpus text"));

    const second = await embedNewChunks(project.id);
    expect(second.embedded).toBe(0);

    await commitChunksStore.upsertCommitChunks({
      inputs: [
        {
          projectId: project.id,
          commitSha: "embed-abc",
          commitMessage: "feat: embeddings",
          author: "tester",
          diffSummary: "changed corpus text",
          metadata: {},
          committedAt: new Date("2026-02-02T00:00:00Z"),
        },
      ],
    });

    const third = await embedNewChunks(project.id);
    expect(third.embedded).toBe(1);
  });

  it("embedding pipeline normalizes legacy rows with null content_hash", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId: legacyProjectId, providerOwner: "test-owner", repositoryName },
    });
    const [row] = await db
      .insert(commitChunks)
      .values({
        projectId: project.id,
        commitSha: "legacy-abc",
        commitMessage: "feat: legacy",
        author: "tester",
        diffSummary: "legacy corpus text",
        metadata: {},
        committedAt: new Date("2026-02-03T00:00:00Z"),
      })
      .returning();
    expect(row.contentHash).toBeNull();

    const result = await embedNewChunks(project.id);
    expect(result.embedded).toBe(1);

    const rows = await db
      .select()
      .from(commitChunks)
      .where(eq(commitChunks.commitSha, "legacy-abc"));
    expect(rows[0].contentHash).toBe(commitChunksStore.contentHashOf("legacy corpus text"));
    expect(rows[0].embeddingHash).toBe(commitChunksStore.contentHashOf("legacy corpus text"));

    const second = await embedNewChunks(project.id);
    expect(second.embedded).toBe(0);
  });

  it("reports-store creates and lists reports linked to a project", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName },
    });
    const reportId = randomUUID();
    const report = await reportsStore.createReport({
      input: {
        id: reportId,
        projectId: project.id,
        title: "Integration Test Report",
        originalMarkdown: "# Integration Test Report",
        editableMarkdown: "# Integration Test Report",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T00:00:00Z"),
        branch: "main",
        customInstructions: null,
      },
    });
    expect(report.id).toBe(reportId);
    expect(report.title).toBe("Integration Test Report");

    const filtered = await reportsStore.listReports({ projectId: project.id });
    expect(filtered.some((r) => r.id === reportId)).toBe(true);
  });

  it("credentials-store CRUD round-trips", async () => {
    const created = await credentialsStore.upsertCredential({
      provider: "openrouter",
      encryptedKey: "encrypted-value",
      keyHint: "sk-test-hint",
    });
    expect(created.keyHint).toBe("sk-test-hint");

    const got = await credentialsStore.getCredentialById(created.id);
    expect(got?.keyHint).toBe("sk-test-hint");

    const listed = await credentialsStore.listCredentials("openrouter");
    expect(listed.some((c) => c.id === created.id)).toBe(true);

    const latest = await credentialsStore.getLatestCredential("openrouter");
    expect(latest?.id).toBe(created.id);

    expect(await credentialsStore.deleteCredentialById(created.id)).toBe(true);
    expect(await credentialsStore.getCredentialById(created.id)).toBeNull();
  });

  it("GET /api/v1/projects and report commits hit postgres", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName },
    });
    const report = await reportsStore.createReport({
      input: {
        id: randomUUID(),
        projectId: project.id,
        title: "Project Commits Report",
        originalMarkdown: "# Project Commits Report",
        editableMarkdown: "# Project Commits Report",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T00:00:00Z"),
        branch: "main",
      },
    });
    await commitChunksStore.upsertCommitChunks({
      inputs: [
        {
          projectId: project.id,
          commitSha: "report-commits-sha",
          commitMessage: "feat: report commits",
          author: "tester",
          diffSummary: "diff summary for report commits",
          committedAt: new Date("2026-01-10T00:00:00Z"),
        },
      ],
    });
    await reportCommitsStore.insertReportCommits({
      reportId: report.id,
      commitShas: ["report-commits-sha"],
    });
    const app = await buildApp();
    try {
      const res = await app.inject({ method: "GET", url: "/api/v1/projects" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.projects.some((p: any) => p.id === project.id)).toBe(true);

      const commits = await app.inject({
        method: "GET",
        url: `/api/v1/reports/${report.id}/commits`,
      });
      expect(commits.statusCode).toBe(200);
      expect(commits.json().commits.some((c: any) => c.commitSha === "report-commits-sha")).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("GET /api/v1/reports returns reports stored in postgres", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName },
    });
    const report = await reportsStore.createReport({
      input: {
        id: randomUUID(),
        projectId: project.id,
        title: "Integration Test Report",
        originalMarkdown: "# Integration Test Report",
        editableMarkdown: "# Integration Test Report",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T00:00:00Z"),
        branch: "main",
      },
    });
    const app = await buildApp();
    try {
      const res = await app.inject({ method: "GET", url: `/api/v1/reports?projectId=${project.id}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const found = body.reports.find((r: any) => r.id === report.id);
      expect(found).toBeDefined();
      expect(found.title).toBe("Integration Test Report");
      expect(found.repositoryName).toBe(repositoryName);
    } finally {
      await app.close();
    }
  });

  it("reports-store updates markdown and bumps updatedAt", async () => {
    const { project } = await projectsStore.upsertProject({
      input: { gitProvider: "github", providerProjectId, providerOwner: "test-owner", repositoryName },
    });
    const report = await reportsStore.createReport({
      input: {
        id: randomUUID(),
        projectId: project.id,
        title: "Update Me",
        originalMarkdown: "# Original",
        editableMarkdown: "# Original",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-31T00:00:00Z"),
        branch: "main",
      },
    });
    const updated = await reportsStore.updateReportMarkdown({
      id: report.id,
      editableMarkdown: "# Edited",
    });
    expect(updated?.editableMarkdown).toBe("# Edited");
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(report.updatedAt.getTime());
  });

  it("deletes a project and cascades to its chunks and reports", async () => {
    const project = await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId });
    expect(project).not.toBeNull();
    if (project) {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
    expect(await projectsStore.getProjectByProviderId({ gitProvider: "github", providerProjectId })).toBeNull();
    if (project) {
      expect(await commitChunksStore.listCommitsForProject({ projectId: project.id })).toHaveLength(0);
    }
  });
});
