"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import {
  IS_DEMO,
  DEMO_PROJECTS,
  DEMO_DEFAULT_REPO,
  type DemoProject,
} from "@/src/shared/constants";

export type DemoProjectEntry = DemoProject & { projectId: string | null };

/**
 * Demo-only helper for the fixed demo repositories. Resolves each configured
 * demo repo to its database project (if it has been ingested yet) and can
 * create it on demand via the same endpoint the "connect repository" flow uses.
 */
export function useDemoProjects() {
  const queryClient = useQueryClient();
  const { projects } = useProjects();

  const findProject = useCallback(
    (demo: DemoProject) =>
      projects.find(
        (p) => p.providerOwner === demo.owner && p.repositoryName === demo.repo,
      ) ?? null,
    [projects],
  );

  const demoProjects = useMemo<DemoProjectEntry[]>(
    () =>
      IS_DEMO
        ? DEMO_PROJECTS.map((demo) => ({
            ...demo,
            projectId: findProject(demo)?.id ?? null,
          }))
        : [],
    [findProject],
  );

  const defaultProject = useMemo(
    () => DEMO_PROJECTS.find((p) => p.repo === DEMO_DEFAULT_REPO) ?? DEMO_PROJECTS[0],
    [],
  );

  const ensureProject = useCallback(
    async (demo: DemoProject): Promise<string | null> => {
      const existing = findProject(demo);
      if (existing) return existing.id;

      const res = await apiClient.POST("/api/v1/projects", {
        body: {
          gitProvider: "github",
          providerProjectId: `${demo.owner}/${demo.repo}`,
          providerOwner: demo.owner,
          repositoryName: demo.repo,
          defaultBranch: "main",
        },
      });
      if (res.error || !res.data) return null;

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
      return res.data.id;
    },
    [findProject, queryClient],
  );

  return { isDemo: IS_DEMO, demoProjects, defaultProject, ensureProject };
}
