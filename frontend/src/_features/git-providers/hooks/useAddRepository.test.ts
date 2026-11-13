import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GitProviderProject,
  GitProviderRepositoryItem,
} from "@/src/shared/types";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  projects: [] as GitProviderProject[],
  connectedProviders: [] as string[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/src/_features/chat/services/projects-api", () => ({
  useCreateProject: () => ({ mutateAsync: mocks.createProject }),
  useProjects: () => ({ projects: mocks.projects }),
}));

vi.mock("@/src/_features/git-providers/services/git-providers-api", () => ({
  useGitConnections: () => ({ connectedProviders: mocks.connectedProviders }),
  useRepositoryFeed: () => ({ repositories: [], isFetching: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { useAddRepository } from "./useAddRepository";

function project(overrides: Partial<GitProviderProject> = {}): GitProviderProject {
  return {
    id: "project-1",
    gitProvider: "github",
    providerProjectId: "1",
    providerOwner: "owner",
    repositoryName: "repo",
    defaultBranch: "main",
    indexedBranches: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as GitProviderProject;
}

function repo(
  overrides: Partial<GitProviderRepositoryItem> = {},
): GitProviderRepositoryItem {
  return {
    id: "1",
    provider: "github",
    name: "repo",
    full_name: "owner/repo",
    private: false,
    updated_at: "2024-01-01T00:00:00Z",
    owner: { login: "owner" },
    description: null,
    default_branch: "main",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.createProject.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.projects = [];
  mocks.connectedProviders = ["github", "gitlab"];
});

describe("useAddRepository", () => {
  it("switches to an existing project instead of creating a duplicate", async () => {
    mocks.projects = [project()];
    const onProjectSelected = vi.fn();
    const { result } = renderHook(() =>
      useAddRepository(onProjectSelected, "github"),
    );

    await act(async () => {
      await result.current.connectByRepo(repo());
    });

    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(onProjectSelected).toHaveBeenCalledWith("project-1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Switched to repo");
    expect(result.current.open).toBe(false);
  });

  it("creates a project from a repository row", async () => {
    mocks.createProject.mockResolvedValue({ id: "new-project" });
    const onProjectSelected = vi.fn();
    const { result } = renderHook(() =>
      useAddRepository(onProjectSelected, "github"),
    );

    await act(async () => {
      await result.current.connectByRepo(repo());
    });

    expect(mocks.createProject).toHaveBeenCalledWith({
      gitProvider: "github",
      providerProjectId: "1",
      providerOwner: "owner",
      repositoryName: "repo",
      defaultBranch: "main",
    });
    expect(onProjectSelected).toHaveBeenCalledWith("new-project");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Connected to repo");
    expect(result.current.connecting).toBe(false);
  });

  it("parses a repository URL and clears the input", async () => {
    mocks.createProject.mockResolvedValue({ id: "new-project" });
    const { result } = renderHook(() => useAddRepository(vi.fn(), "github"));

    act(() => {
      result.current.onValueChange("https://github.com/owner/repo.git");
    });
    await act(async () => {
      await result.current.connectByUrl();
    });

    expect(mocks.createProject).toHaveBeenCalledWith({
      gitProvider: "github",
      providerProjectId: "owner/repo",
      providerOwner: "owner",
      repositoryName: "repo",
      defaultBranch: "main",
    });
    expect(result.current.value).toBe("");
  });

  it("rejects an invalid repository URL without creating anything", async () => {
    const { result } = renderHook(() => useAddRepository(vi.fn(), "github"));

    act(() => {
      result.current.onValueChange("not-a-repository");
    });
    await act(async () => {
      await result.current.connectByUrl();
    });

    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/valid GitHub URL or owner\/repo/i);
  });

  it("blocks a URL for a provider that is not connected", async () => {
    mocks.connectedProviders = ["github"];
    const { result } = renderHook(() => useAddRepository(vi.fn(), "github"));

    act(() => {
      result.current.onValueChange("https://gitlab.com/group/repo");
    });
    await act(async () => {
      await result.current.connectByUrl();
    });

    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Connect GitLab first/i);
  });

  it("surfaces create failures and resets the connecting state", async () => {
    mocks.createProject.mockRejectedValue(new Error("create failed"));
    const { result } = renderHook(() => useAddRepository(vi.fn(), "github"));

    await act(async () => {
      await result.current.connectByRepo(repo());
    });

    expect(mocks.toastError).toHaveBeenCalledWith("create failed");
    expect(result.current.connecting).toBe(false);
  });
});
