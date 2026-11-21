import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoProject } from "@/src/shared/constants";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  toastError: vi.fn(),
  projects: [] as Array<{
    id: string;
    providerOwner: string;
    repositoryName: string;
  }>,
}));

vi.mock("@/src/shared/constants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/shared/constants")>();
  return { ...actual, IS_DEMO: true };
});

vi.mock("@/src/_features/chat/services/projects-api", () => ({
  useCreateProject: () => ({ mutateAsync: mocks.createProject }),
  useProjects: () => ({ projects: mocks.projects }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

import { useDemoProjects } from "./useDemoProjects";

const formbricks: DemoProject = {
  id: "500289888",
  owner: "formbricks",
  repo: "formbricks",
  label: "formbricks",
  defaultBranch: "main",
};

describe("useDemoProjects", () => {
  beforeEach(() => {
    mocks.createProject.mockReset();
    mocks.toastError.mockReset();
    mocks.projects = [];
  });

  it("lists the configured demo projects", () => {
    const { result } = renderHook(() => useDemoProjects());

    expect(result.current.isDemo).toBe(true);
    expect(result.current.demoProjects).toHaveLength(2);
  });

  it("reuses a project that already exists", async () => {
    mocks.projects = [
      {
        id: "existing",
        providerOwner: "formbricks",
        repositoryName: "formbricks",
      },
    ];
    const { result } = renderHook(() => useDemoProjects());

    await expect(result.current.ensureProject(formbricks)).resolves.toBe(
      "existing",
    );
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("creates the project when it is missing", async () => {
    mocks.createProject.mockResolvedValue({ id: "created" });
    const { result } = renderHook(() => useDemoProjects());

    await expect(result.current.ensureProject(formbricks)).resolves.toBe(
      "created",
    );
    expect(mocks.createProject).toHaveBeenCalledWith({
      gitProvider: "github",
      providerProjectId: formbricks.id,
      providerOwner: formbricks.owner,
      repositoryName: formbricks.repo,
      defaultBranch: formbricks.defaultBranch,
    });
  });

  it("returns null and reports the error when creation fails", async () => {
    mocks.createProject.mockRejectedValue(new Error("request failed"));
    const { result } = renderHook(() => useDemoProjects());

    await expect(result.current.ensureProject(formbricks)).resolves.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith("request failed");
  });
});
