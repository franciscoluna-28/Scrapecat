import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { GitProviderProject } from "@/src/shared/types";
import { DEMO_PROJECTS } from "@/src/shared/constants";
import { useActiveProjectStore } from "@/src/store/active-project";
import { useChatBranchStore } from "@/src/store/chat-branch";
import { resolveActiveProjectId, useChatProject } from "./useChatProject";

function project(id: string, repositoryName = id): GitProviderProject {
  return {
    id,
    repositoryName,
    providerOwner: `owner-${id}`,
    gitProvider: "github",
  } as GitProviderProject;
}

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  projects: [] as GitProviderProject[],
  projectsLoading: false,
  branches: [] as string[],
  defaultBranch: "main" as string | null,
  isDemo: false,
  ensureProject: vi.fn(),
  prepareBranch: vi.fn(),
  useBranches: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("../services/projects-api", () => ({
  useProjects: () => ({
    projects: mocks.projects,
    isLoading: mocks.projectsLoading,
  }),
}));

vi.mock("../services/chat-api", () => ({
  usePrepareProjectBranch: () => ({ mutateAsync: mocks.prepareBranch }),
}));

vi.mock("@/src/_features/git-providers/services/git-providers-api", () => ({
  useBranches: mocks.useBranches,
}));

vi.mock("@/src/_features/demo/hooks/useDemoProjects", () => ({
  useDemoProjects: () => ({
    isDemo: mocks.isDemo,
    ensureProject: mocks.ensureProject,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  useActiveProjectStore.setState({ lastProjectId: null });
  useChatBranchStore.setState({ branches: {} });

  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.ensureProject.mockReset();
  mocks.prepareBranch.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.searchParams = new URLSearchParams();
  mocks.projects = [project("p1", "repo-one"), project("p2", "repo-two")];
  mocks.projectsLoading = false;
  mocks.branches = ["main", "dev"];
  mocks.defaultBranch = "main";
  mocks.isDemo = false;
  mocks.useBranches.mockImplementation(() => ({
    branches: mocks.branches,
    defaultBranch: mocks.defaultBranch,
  }));
});

describe("resolveActiveProjectId", () => {
  const base = {
    projects: [project("p1"), project("p2")],
    projectsLoading: false,
    isDemo: false,
  };

  it("prefers the URL project param", () => {
    expect(
      resolveActiveProjectId({
        ...base,
        projectParam: "p2",
        lastProjectId: "p1",
      }),
    ).toBe("p2");
  });

  it("falls back to the last-used project", () => {
    expect(
      resolveActiveProjectId({
        ...base,
        projectParam: null,
        lastProjectId: "p2",
      }),
    ).toBe("p2");
  });

  it("falls back to the first project when there is no history", () => {
    expect(
      resolveActiveProjectId({
        ...base,
        projectParam: null,
        lastProjectId: null,
      }),
    ).toBe("p1");
  });

  it("does not auto-select while loading, in demo mode, or with no projects", () => {
    expect(
      resolveActiveProjectId({
        ...base,
        projectsLoading: true,
        projectParam: null,
        lastProjectId: "p2",
      }),
    ).toBeNull();
    expect(
      resolveActiveProjectId({
        ...base,
        isDemo: true,
        projectParam: null,
        lastProjectId: "p2",
      }),
    ).toBeNull();
    expect(
      resolveActiveProjectId({
        ...base,
        projects: [],
        projectParam: null,
        lastProjectId: "p2",
      }),
    ).toBeNull();
  });
});

describe("useChatProject", () => {
  it("derives the active project and branch without a navigation effect", () => {
    useActiveProjectStore.setState({ lastProjectId: "p2" });
    const { result } = renderHook(() => useChatProject());

    expect(result.current.projectId).toBe("p2");
    expect(result.current.activeProject).toBe("repo-two");
    expect(mocks.useBranches).toHaveBeenCalledWith(
      "owner-p2",
      "repo-two",
      "github",
    );
    expect(result.current.branch).toBe("main");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("prefers the stored branch over the default branch", () => {
    useActiveProjectStore.setState({ lastProjectId: "p2" });
    useChatBranchStore.setState({ branches: { p2: "dev" } });
    const { result } = renderHook(() => useChatProject());

    expect(result.current.branch).toBe("dev");
  });

  it("prepares the branch through the mutation before storing it", async () => {
    useActiveProjectStore.setState({ lastProjectId: "p2" });
    mocks.prepareBranch.mockResolvedValue(undefined);
    const { result } = renderHook(() => useChatProject());

    await act(async () => {
      await result.current.changeBranch("dev");
    });

    expect(mocks.prepareBranch).toHaveBeenCalledWith({
      projectId: "p2",
      branch: "dev",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Ready to chat on dev");
    expect(useChatBranchStore.getState().branches.p2).toBe("dev");
  });

  it("selects a demo project and persists it as last-used", async () => {
    mocks.ensureProject.mockResolvedValue("demo-project-id");
    const { result } = renderHook(() => useChatProject());

    await act(async () => {
      await result.current.selectProject(DEMO_PROJECTS[0]);
    });

    expect(mocks.ensureProject).toHaveBeenCalledWith(DEMO_PROJECTS[0]);
    expect(useActiveProjectStore.getState().lastProjectId).toBe(
      "demo-project-id",
    );
    expect(mocks.push).toHaveBeenCalledWith("/app?project=demo-project-id");
  });
});
