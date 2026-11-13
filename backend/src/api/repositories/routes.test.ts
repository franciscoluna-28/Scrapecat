import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProjectByOwnerRepo = vi.fn();
const mockGetProjectByProviderId = vi.fn();
const mockUpsertProject = vi.fn();

vi.mock("@/api/repositories/stores/projects-store", () => ({
  projectsStore: {
    getProjectByOwnerRepo: (...args: unknown[]) =>
      mockGetProjectByOwnerRepo(...args),
    getProjectByProviderId: (...args: unknown[]) =>
      mockGetProjectByProviderId(...args),
    upsertProject: (...args: unknown[]) => mockUpsertProject(...args),
  },
}));

vi.mock("@/api/repositories/services", () => ({
  listProjects: vi.fn(async () => []),
  prepareProjectBranch: vi.fn(),
}));

vi.mock("@/shared/integrations/git-provider", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/shared/integrations/git-provider")
  >();
  return { ...actual, getGitProvider: vi.fn() };
});

vi.mock("@/shared/integrations/git-provider/token", () => ({
  resolveGitToken: vi.fn(async () => null),
}));

import { buildApp } from "@/build-app";

const existing = {
  id: "11111111-1111-4111-8111-111111111111",
  gitProvider: "github",
  providerProjectId: "123",
  providerOwner: "victim",
  repositoryName: "repo",
  defaultBranch: "main",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("POST /api/v1/projects", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetProjectByOwnerRepo.mockReset().mockResolvedValue(null);
    mockGetProjectByProviderId.mockReset();
    mockUpsertProject.mockReset();
  });

  it("rejects a provider id that belongs to another repository", async () => {
    mockGetProjectByProviderId.mockResolvedValue(existing);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: {
        gitProvider: "github",
        providerProjectId: "123",
        providerOwner: "attacker",
        repositoryName: "other",
        defaultBranch: "main",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(mockUpsertProject).not.toHaveBeenCalled();
  });

  it("returns the existing project for the same repository", async () => {
    mockGetProjectByProviderId.mockResolvedValue(existing);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: {
        gitProvider: "github",
        providerProjectId: "123",
        providerOwner: "victim",
        repositoryName: "repo",
        defaultBranch: "main",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(existing.id);
    expect(mockUpsertProject).not.toHaveBeenCalled();
  });

  it("rejects traversal-shaped repository metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: {
        gitProvider: "github",
        providerProjectId: "123",
        providerOwner: "..",
        repositoryName: "repo",
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
