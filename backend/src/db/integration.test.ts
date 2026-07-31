import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { githubProjects, credentials } from "./schema";
import * as projectsStore from "./stores/projects-store";
import * as commitChunksStore from "./stores/commit-chunks-store";
import * as reportsStore from "./stores/reports-store";
import * as credentialsStore from "./stores/credentials-store";
import { buildApp } from "../app";

const enabled = process.env.DB_INTEGRATION === "1";

describe.runIf(enabled)("postgres integration (set DB_INTEGRATION=1)", () => {
  const githubProjectId = 999_999_001;
  const repositoryName = "integration-test-repo";
  const credentialName = "integration-test-key";

  beforeAll(async () => {
    const project = await projectsStore.getProjectByGithubId(githubProjectId);
    if (project) {
      await db.delete(githubProjects).where(eq(githubProjects.id, project.id));
    }
    const existing = await credentialsStore.listCredentials();
    for (const c of existing) {
      if (c.name === credentialName) {
        await credentialsStore.deleteCredentialById(c.id);
      }
    }
  });

  afterAll(async () => {
    const project = await projectsStore.getProjectByGithubId(githubProjectId);
    if (project) {
      await db.delete(githubProjects).where(eq(githubProjects.id, project.id));
    }
    const existing = await credentialsStore.listCredentials();
    for (const c of existing) {
      if (c.name === credentialName) {
        await credentialsStore.deleteCredentialById(c.id);
      }
    }
  });

  it("projects-store upserts idempotently and lists", async () => {
    const p = await projectsStore.upsertProject({ githubProjectId, repositoryName, defaultBranch: "main" });
    expect(p.repositoryName).toBe(repositoryName);
    expect(p.defaultBranch).toBe("main");

    const p2 = await projectsStore.upsertProject({ githubProjectId, repositoryName: `${repositoryName}-v2` });
    expect(p2.id).toBe(p.id);
    expect(p2.repositoryName).toBe(`${repositoryName}-v2`);

    const all = await projectsStore.listProjects();
    expect(all.some((x) => x.githubProjectId === githubProjectId)).toBe(true);
  });

  it("commit-chunks-store upserts with dedupe and filters by date range", async () => {
    const project = await projectsStore.upsertProject({ githubProjectId, repositoryName });
    const chunk = {
      projectId: project.id,
      commitSha: "abc123",
      commitMessage: "feat: integration test",
      author: "tester",
      diffSummary: "diff summary for integration test",
      metadata: { additions: 5, deletions: 2, filesChanged: ["src/a.ts"] },
      committedAt: new Date("2026-01-10T00:00:00Z"),
    };
    await commitChunksStore.upsertCommitChunks([chunk]);
    await commitChunksStore.upsertCommitChunks([chunk]);

    const all = await commitChunksStore.listCommitsForProject(project.id);
    expect(all.filter((c) => c.commitSha === "abc123")).toHaveLength(1);
    expect(all[0].diffSummary).toBe("diff summary for integration test");

    const inRange = await commitChunksStore.listCommitsForProject(project.id, {
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    });
    expect(inRange.some((c) => c.commitSha === "abc123")).toBe(true);

    const outOfRange = await commitChunksStore.listCommitsForProject(project.id, {
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-01-31"),
    });
    expect(outOfRange.filter((c) => c.commitSha === "abc123")).toHaveLength(0);
  });

  it("reports-store creates and lists reports linked to a project", async () => {
    const project = await projectsStore.upsertProject({ githubProjectId, repositoryName });
    const reportId = randomUUID();
    const report = await reportsStore.createReport({
      id: reportId,
      projectId: project.id,
      title: "Integration Test Report",
      originalMarkdown: "# Integration Test Report",
      editableMarkdown: "# Integration Test Report",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
      branch: "main",
      customInstructions: null,
    });
    expect(report.id).toBe(reportId);
    expect(report.title).toBe("Integration Test Report");

    const filtered = await reportsStore.listReports({ projectId: project.id });
    expect(filtered.some((r) => r.id === reportId)).toBe(true);
  });

  it("credentials-store CRUD round-trips", async () => {
    const created = await credentialsStore.insertCredential({
      provider: "openrouter",
      name: credentialName,
      encryptedKey: "encrypted-value",
      keyHint: "sk-test-hint",
    });
    expect(created.keyHint).toBe("sk-test-hint");

    const got = await credentialsStore.getCredentialById(created.id);
    expect(got?.name).toBe(credentialName);

    const listed = await credentialsStore.listCredentials("openrouter");
    expect(listed.some((c) => c.id === created.id)).toBe(true);

    const latest = await credentialsStore.getLatestCredential("openrouter");
    expect(latest?.id).toBe(created.id);

    expect(await credentialsStore.deleteCredentialById(created.id)).toBe(true);
    expect(await credentialsStore.getCredentialById(created.id)).toBeNull();
  });

  it("GET /api/v1/projects and project commits hit postgres", async () => {
    const project = await projectsStore.upsertProject({ githubProjectId, repositoryName });
    const app = await buildApp();
    try {
      const res = await app.inject({ method: "GET", url: "/api/v1/projects" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.projects.some((p: any) => p.id === project.id)).toBe(true);

      const commits = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.id}/commits?startDate=2026-01-01&endDate=2026-01-31`,
      });
      expect(commits.statusCode).toBe(200);
      expect(commits.json().commits.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it("GET /api/v1/reports returns reports stored in postgres", async () => {
    const project = await projectsStore.upsertProject({ githubProjectId, repositoryName });
    const report = await reportsStore.createReport({
      id: randomUUID(),
      projectId: project.id,
      title: "Integration Test Report",
      originalMarkdown: "# Integration Test Report",
      editableMarkdown: "# Integration Test Report",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
      branch: "main",
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
    const project = await projectsStore.upsertProject({ githubProjectId, repositoryName });
    const report = await reportsStore.createReport({
      id: randomUUID(),
      projectId: project.id,
      title: "Update Me",
      originalMarkdown: "# Original",
      editableMarkdown: "# Original",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
      branch: "main",
    });
    const updated = await reportsStore.updateReportMarkdown(report.id, "# Edited");
    expect(updated?.editableMarkdown).toBe("# Edited");
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(report.updatedAt.getTime());
  });

  it("deletes a project and cascades to its chunks and reports", async () => {
    const project = await projectsStore.getProjectByGithubId(githubProjectId);
    expect(project).not.toBeNull();
    if (project) {
      await db.delete(githubProjects).where(eq(githubProjects.id, project.id));
    }
    expect(await projectsStore.getProjectByGithubId(githubProjectId)).toBeNull();
    if (project) {
      expect(await commitChunksStore.listCommitsForProject(project.id)).toHaveLength(0);
    }
  });
});
