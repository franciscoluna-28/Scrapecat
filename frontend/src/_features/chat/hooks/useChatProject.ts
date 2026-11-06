"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useActiveProjectStore } from "@/src/store/active-project";
import { useChatBranchStore } from "@/src/store/chat-branch";
import { errorMessage } from "@/src/shared/api/client";
import { useBranches } from "@/src/_features/git-providers/services/git-providers-api";
import { useDemoProjects } from "@/src/_features/demo/hooks/useDemoProjects";
import { DEMO_PROJECTS, IS_DEMO } from "@/src/shared/constants";
import { useProjects } from "../services/projects-api";
import { usePrepareProjectBranch } from "../services/chat-api";

type DemoProject = (typeof DEMO_PROJECTS)[number];
type ProjectList = ReturnType<typeof useProjects>["projects"];

type ResolveActiveProjectIdOptions = {
  projectParam: string | null;
  lastProjectId: string | null;
  projects: ProjectList;
  projectsLoading: boolean;
  isDemo: boolean;
};

/**
 * Falls back to the last-used (or first) project when the URL has no `project`
 * param, so `/app` works without a redirect effect.
 */
export function resolveActiveProjectId({
  projectParam,
  lastProjectId,
  projects,
  projectsLoading,
  isDemo,
}: ResolveActiveProjectIdOptions): string | null {
  if (projectParam) return projectParam;
  if (isDemo || projectsLoading) return null;
  return projects.find((p) => p.id === lastProjectId)?.id ?? projects[0]?.id ?? null;
}

/**
 * Single source for the active project/session. The URL wins; the last-used
 * project is only a fallback for `/app` without a `project` param.
 */
export function useActiveProject() {
  const searchParams = useSearchParams();
  const { projects, isLoading: projectsLoading } = useProjects();
  const lastProjectId = useActiveProjectStore((s) => s.lastProjectId);

  return {
    projectId: resolveActiveProjectId({
      projectParam: searchParams.get("project"),
      lastProjectId,
      projects,
      projectsLoading,
      isDemo: IS_DEMO,
    }),
    sessionId: searchParams.get("session"),
    projects,
    projectsLoading,
  };
}

export function useChatProject() {
  const router = useRouter();
  const { projectId, sessionId, projects } = useActiveProject();
  const { ensureProject } = useDemoProjects();
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);
  const branchesByProject = useChatBranchStore((s) => s.branches);
  const setBranch = useChatBranchStore((s) => s.setBranch);
  const { mutateAsync: prepareBranch } = usePrepareProjectBranch();

  const activeProjectData = projects.find((p) => p.id === projectId) ?? null;
  const activeProject = activeProjectData?.repositoryName ?? null;

  const { branches, defaultBranch } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
    activeProjectData?.gitProvider,
  );

  const branch = projectId
    ? (branchesByProject[projectId] ?? defaultBranch ?? "")
    : null;

  useEffect(() => {
    if (projectId) setLastProjectId(projectId);
  }, [projectId, setLastProjectId]);

  const selectProject = useCallback(
    async (demo: DemoProject) => {
      const id = await ensureProject(demo);
      if (!id) return;
      setLastProjectId(id);
      router.push(`/app/chat?project=${id}`);
    },
    [ensureProject, router, setLastProjectId],
  );

  const changeBranch = useCallback(
    async (branchName: string) => {
      if (!projectId) return;
      try {
        await prepareBranch({ projectId, branch: branchName });
        toast.success(`Ready to chat on ${branchName}`);
        setBranch(projectId, branchName);
      } catch (error) {
        toast.error(errorMessage(error, "Failed to prepare branch"));
      }
    },
    [prepareBranch, projectId, setBranch],
  );

  return {
    projectId,
    sessionId,
    activeProject,
    branches,
    branch,
    defaultBranch,
    selectProject,
    changeBranch,
  };
}
